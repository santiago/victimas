const fs = require('fs');
const crypto = require('crypto');
const unirest = require('unirest');
const cheerio = require('cheerio');
const _ = require('lodash');
const Promise = require('bluebird');

const elasticsearch = require('elasticsearch');
const INDEX = 'victimas';
const es = new elasticsearch.Client({
  host: '173.230.141.159:9200',
  // log: 'trace'
});

var ubicaciones = {};

module.exports = (opts) => {
  extractQueryOptions((err, queryOptions) => {
    this.opts = opts;

    var extractData = extractDataByDepartamento.bind(this, queryOptions);

    var departamentos = queryOptions.departamentos;
    if(opts.departamento) {
      departamentos = departamentos.slice(
        departamentos.indexOf(opts.departamento)
      );
    }

    Promise.each(departamentos, extractData)
      .then((result) => {
        fs.writeFile('./data/geo-municipios-colombia.json', ubicaciones, () => {});
        console.log('Done!');
      })
      .catch((err) => {
        console.log(err);
      });
  });
};

function extractDataByDepartamento(queryOptions, departamento, i, l, cb) {
  var sendQueryPromise = Promise.promisify(sendQuery);

  var clasificaciones = queryOptions.clasificaciones.slice();
  if(this.opts.clasificacion) {
    clasificaciones = clasificaciones.slice(
      clasificaciones.indexOf(this.opts.clasificacion)
    );
  }

  return Promise.each(
    clasificaciones,
    sendQueryPromise
  ).then(() => {
    // console.log(ubicaciones);
  });

  function sendQuery(clasificacion, i, l, cb) {
    var query = {};
    query['evita_csrf'] = queryOptions.csrf;
    query['_qf_default:consultaWeb'] = 'id_departamento';
    query['id_departamento'] = departamento;//15;//
    query['clasificacion[]'] = clasificacion;//'D:1:98';//;
    query['critetiqueta'] = '0';
    query['orden'] = 'fecha';
    query['mostrar'] = 'tabla';
    query['caso_memo'] = '1';
    query['caso_fecha'] = '1';
    query['m_ubicacion'] = '1';
    query['m_victimas'] = '1';
    query['m_presponsables'] = '1';
    query['m_tipificacion'] = '1';
    query['concoordenadas'] = '1';
    query['_qf_consultaWeb_consulta'] = 'Consulta';

    console.log(`Consultando depto: ${departamento} - tipif: ${clasificacion}`);

    unirest.post("https://www.nocheyniebla.org/consulta_web.php")
      .strictSSL(false)
      .headers({
        'Accept': 'text/csv,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': queryOptions.cookie
      })
      .send(query)
      .end((res) => {
        var records = processResponse(res);
        // console.log(records.victimas);
        // process.exit();
        cb();
      });
  }
}

function parseReporte(data) {
  const [descripcion, fecha, ubicacion, victimas, responsable, tipificacion] = data;
  return {
    'descripcion': descripcion,
    'fecha': fecha,
    'ubicacion': (() => {
        ubicaciones[ubicacion] = (ubicaciones[ubicacion] || 0) + 1;
        return ubicacion.split(';')
          .map(i => i.trim().split('/').map(j => j.trim()).join(','));
    })(),
    'victimas': victimas,
    'responsable': responsable.split(',').map(i => i.trim()),
    'tipificacion': tipificacion.split(',').map(i => i.trim().split(' ').shift())
  }
}

function parseVictimas(r) {
  var [_victimas, _total] = r.victimas.split('|').map(i => i.trim());
  const total = parseInt(_total.split(':').pop().trim());

  // Here's a sample of the victim's name string.
  // It can contain one or more tipificaciones,
  // as well as a birth year in parenthesis.
  // FULANITO DETAL Y PASCUAL (1978) B41, D703
  var victimas = _victimas.split(',')
                      // On the split this record would turn into
                      // ['FULANITO DETAL Y PASCUAL (1978) B41', 'D703']
                      .map((v) => v.trim().split(' '))
                      // In case there were more than one `tipificacion`
                      // like shown in the sample victima above,
                      // we add them appropriately to each record.
                      .filter((v,i,a) => {
                        // If the victima record is empty discard it
                        if(!v || !v.length || !v[0]) return;

                        // If victima is NN we discard from here
                        if(v.slice(0,2).join('') == 'NN') return;


                        // If `v` only has a single element it's most likely
                        // it is a `tipificacion` from the previous element.
                        // In this case we concat the `tipificacion` to the
                        // last element of the previous element.
                        // We filter such that single-element elements are
                        // discarded.
                        if(v.length == 1 && v[0].match(/^[A-Z]\d+$/)) {
                          const l = a[i-1].length;
                          a[i-1][l-1] += `,${v[0]}`;
                          return;
                        }
                        return v;
                      });

  if(!victimas.length) { return [] }

  // console.log('\n-->>');
  // console.log(total);
  // console.log(r);
  // console.log(_victimas);
  // console.log(victimas);

  const tipificaciones = victimas.map(v => _.uniq(v.pop().split(',')));

  // For some victims they include
  // they birth year
  const nacimientos = victimas.map((v) => {
    var pop = v.pop();
    try {
      var year = pop.match(/(\d{4})/);
      year = year && year[1];
      year || v.push(pop);
      return year;
    } catch(e) {
      console.log('->>');
      console.log(v);
    }
  });

  return victimas.map((v, i) => {
    const nombre = v.join(' ');
    return {
      "id": genId(nombre + r.ubicacion.join()),
      "nombre": nombre,
      "nacimiento": nacimientos[i],
      "fecha" : r.fecha,
      "tipificacion": tipificaciones[i],
      "responsable" : r.responsable,
      "ubicacion" : r.ubicacion,
      // "location" : {}
    }
  });
}

function processResponse(res) {
  if(res.error) { return cb(res.error); }

  const $ = cheerio.load(res.body);

  var reportes = [];
  var victimas = [];

  // Each record(Reporte) found
  $('table tr').each((i, tr) => {
    // If i=0 it is the header, ignore
    if(!i) { return }

    var reporteData = [];
    $(tr).find('td').each((j, td) => {
      const d = $(td).text();
      reporteData.push(d);
    });
    const reporte = parseReporte(reporteData);
    reportes.push(reporte);

    var victimasReporte = parseVictimas(reporte);
    reporte.victimas = victimasReporte.map(i => i.nombre);
    victimas = victimas.concat(victimasReporte);
  });

  reportes.length && saveRecords({ caso: reportes });
  victimas.length && saveRecords({ victima: victimas });

  // process.exit();

  return { reportes: reportes, victimas: victimas };
}

function extractQueryOptions(cb) {
  unirest.get("https://www.nocheyniebla.org/consulta_web.php")
    .strictSSL(false)
    .end((res) => {
      const $ = cheerio.load(res.body);
      const csrf = $('form').find('[name=evita_csrf]').attr('value');
      const cookie = res.headers['set-cookie'];

      const queryOptions = {
        cookie: res.headers['set-cookie'],

        csrf: $('form').find('[name=evita_csrf]').attr('value'),

        clasificaciones: $('form').find('[name=clasificacion\\[\\]] option').map(function() {
          return $(this).attr('value').trim();
        }).toArray(),

        departamentos: _.compact($('form').find('[name=id_departamento] option').map(function() {
          return $(this).attr('value').trim();
        }))
      };

      cb(null, queryOptions);
    });
}

function saveRecords(records, cb) {
  var recordType = Object.keys(records)[0];
  var data = [];

  records[recordType].forEach((r) => {
    data.push({ index:  { _index: INDEX, _type: recordType, _id: r.id } });
    data.push(r);
  });

  es.bulk({ body: data }, (err, res) => {
    if(res.errors) {
      res.items.forEach(i => console.log(i.index.error.caused_by));
    }
    if(err) { console.log(err); }
    cb && cb();
  });
}

function genId(str) {
  const secret = `qwerty`;
  const hash = crypto.createHmac('sha256', secret)
                  .update(str)
                  .digest('hex');
  return hash;
}
