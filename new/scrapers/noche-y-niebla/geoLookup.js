const unirest = require('unirest');
const Promise = require('bluebird');
const es = require('elasticsearch');
const fs = require('fs');

fs.readFile('./data/geo-municipios-colombia.json', (err, data) => {
  console.log(data);
});

function lookup(q) {
  var url = "http://nominatim.openstreetmap.org/search?format=json&q="+q;
  unirest.get(url)
    .strictSSL(false)
    .end((res) => {
      var muni = _.compact(q.split('+'));
      var places = JSON.parse(res.text);

      var first = places.filter(function(p) {
          return p.type == 'town';
      }).shift() || places.shift();
      try {
          var location = [first.lat, first.lon];
          console.log(muni);
          console.log(location);
          redis.hset('municipios:location', muni, location);
          nextLocation();
      } catch(e) {
          console.log(places);
          nextLocation();
      }
  });
}
