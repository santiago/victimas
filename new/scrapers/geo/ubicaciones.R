library(dplyr)

getUbicaciones <- function() {
  query <- '{
    "aggs": {
      "ubicaciones": {
        "terms": {
          "field": "ubicacion.keyword",
          "size": 3000,
          "shard_size": 2
        }      
      }
    }
  }'
  
  url <- 'http://173.230.141.159:9200/victimas/caso/_search'
  res <- httr::POST(url=url, body=query)
  data <- jsonlite::fromJSON(httr::content(res, 'text'))
  data$aggregations$ubicaciones$buckets
}

getGeo <- function() {
  ubicaciones <- getUbicaciones()
  
  queries <- lapply(strsplit(ubicaciones$key, ','), function(u) {
    paste(
      paste(rev(u), collapse = ','),
      'COLOMBIA', sep = ','
    )
  })
  
  baseUrl <- 'http://nominatim.openstreetmap.org/search?format=json&q='
  urls <- paste0(url, queries)
  
  namedUrls <- setNames(urls, ubicaciones$key)
  
  i <- 62
  
  dataList <- lapply(namedUrls[62:length(namedUrls)], function(url) {
    i <<- i+1
    print(paste(i, url))
    res <- httr::GET(url=URLencode(url))
    d <- jsonlite::fromJSON(httr::content(res, 'text'))
    if(length(d) != 0) { 
      locationType <- c('city', 'town', 'village')
      dd <- (d %>% filter(type %in% locationType))[1,c('lat', 'lon', 'display_name')]
    } else {
      c(NA, NA, NA)
    }
  })

  dataFrame <- data.frame(
    matrix(
      unlist(dataList),
      nrow = length(dataList),
      byrow = T
    )
  )
  
  dataFrame$key <- names(dataList)
  colnames(dataFrame) <- c('lat', 'lon', 'display_name', 'key')

  
}