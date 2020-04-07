// PaiTuli backend endpoints
const METADATA_API = '/api/datasets'
const DOWNLOAD_API = '/api/download'

const GEOSERVER_BASE = '//avaa.tdata.fi/geoserver/' // "//avoin-test.csc.fi/geoserver/"
const ETSIN_BASE = '//metax.fairdata.fi' // "//metax-test.csc.fi" "//etsin.avointiede.fi" "//etsin-demo.avointiede.fi"

export const LAYER = {
  INDEX_LAYER: 'paituli:index',
  MUNICIPALITIES_LAYER: 'paituli:mml_hallinto_2014_100k',
  CATCHMENT_AREAS_LAYER: 'paituli:syke_valuma_maa',
}

export const URL = {
  METADATA_API,
  DOWNLOAD_API,

  // Links tab
  FTP_LINKS_BASE: 'ftp://ftp.funet.fi/index/geodata/',
  HTTP_LINKS_BASE: 'http://www.nic.funet.fi/index/geodata/',
  INFO_LINK: 'https://avaa.tdata.fi/web/paituli/ftp-/-rsync',

  // Etsin
  ETSIN_METADATA_BASE: 'http://urn.fi/',
  ETSIN_METADATA_JSON_BASE:
    ETSIN_BASE + '/rest/datasets?format=json&preferred_identifier=',

  // GeoServer
  WFS_INDEX_MAP_LAYER:
    GEOSERVER_BASE +
    'wfs?service=WFS&version=2.0.0&request=GetFeature&srsname=epsg:3857&typeNames=' +
    LAYER.INDEX_LAYER +
    "&cql_filter= !key! = '!value!'",
  WMS_INDEX_MAP_LABEL_LAYER:
    GEOSERVER_BASE +
    'wms?service=WMS&LAYERS= ' +
    LAYER.INDEX_LAYER +
    "&CQL_FILTER=data_id = '!value!'",
  WMS_PAITULI_BASE: GEOSERVER_BASE + 'wms?',
  WMS_PAITULI_BASE_GWC: GEOSERVER_BASE + 'gwc/service/wms?',
  WFS_INDEX_MAP_DOWNLOAD_SHAPE:
    GEOSERVER_BASE +
    'wfs?service=WFS&version=2.0.0&request=GetFeature&srsname=epsg:4326&typeNames=' +
    LAYER.INDEX_LAYER +
    "&outputFormat=shape-zip&propertyname=label,path,geom&cql_filter= !key! = '!value!'",

  // Location search
  NOMINATIM_API:
    '//nominatim.openstreetmap.org/search?format=json&q=!query!&addressdetails=0&limit=1',
}
