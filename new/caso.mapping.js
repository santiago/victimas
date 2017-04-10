{
  "caso": {
    "properties": {
      "descripcion": {
        "type": "string"
      },
      "fecha": {
        "type": "date",
        "format": "dateOptionalTime"
      },
      "responsable": {
        "type": "string",
        "analyzer": "keyword"
      },
      "tipificacion": {
        "type": "string",
        "analyzer": "keyword"
      },
      "ubicacion": {
        "type": "string",
        "analyzer": "keyword"
      },
      "victimas": {
        "type": "string",
        "analyzer": "keyword"
      },
      "location": {
        "type": "geo_point"
      },
      "DIVIPOLA": {
        "type": "string",
        "analyzer": "keyword"
      }
    }
  }
}
