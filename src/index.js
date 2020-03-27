import alasql from 'alasql'
import $ from 'jquery'
import 'jquery-ui-bundle/jquery-ui'
import { Collection, Map, View } from 'ol'
import * as control from 'ol/control'
import * as condition from 'ol/events/condition'
import * as format from 'ol/format'
import * as interaction from 'ol/interaction'
import * as layer from 'ol/layer'
import { unByKey } from 'ol/Observable'
import * as proj from 'ol/proj'
import { register } from 'ol/proj/proj4'
import * as source from 'ol/source'
import * as style from 'ol/style'
import LayerSwitcher from 'ol-layerswitcher'
import proj4 from 'proj4'

import Translator from './translator'

import 'bootstrap/dist/css/bootstrap.min.css'
import 'jquery-ui-bundle/jquery-ui.css'
import 'ol/ol.css'
import 'ol-layerswitcher/src/ol-layerswitcher.css'
import './index.css'

const METADATA_API = '/api/datasets'
const GENERATE_PACKAGE_API_URL = '/download'

const FINNISH_LANGUAGE = 'fi_FI'
const ENGLISH_LANGUAGE = 'en_US'
let currentLocale = FINNISH_LANGUAGE

let hakaUser = false
let currentIndexMapLayer = null
let metadata = null
let selectedTool = ''

proj4.defs([
  [
    'EPSG:3067',
    '+proj=utm +zone=35 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
  ],
  [
    'EPSG:3857',
    '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs',
  ],
])
register(proj4)

function getUrlParameter(param) {
  const pageURL = window.location.search.substring(1)
  const urlVariables = pageURL.split('&')
  for (let i = 0; i < urlVariables.length; i++) {
    const parameterName = urlVariables[i].split('=')
    if (parameterName[0] == param) {
      return parameterName[1]
    }
  }
  return null
}

let pageDataIdParam = getUrlParameter('data_id')

/* TODO Haka login

let geoserver_username = ''
let geoserver_password = ''

// If the user is logged in with HAKA, let's set ready GeoServer's username and
// password for paituli_protected datasets
function checkAccessRights() {
  hakaUser = Liferay.ThemeDisplay.isSignedIn()
  if (hakaUser) {
    $.ajax({
      url: '/secure/files/geoserverp.txt',
      dataType: 'json',
      success: (result) => {
        geoserver_username = result.username
        geoserver_password = result.pwd
        let testurl =
          'https://avaa.tdata.fi/geoserver/paituli_protected/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=paituli_protected:il_temp_monthly_stat&maxFeatures=1&outputFormat=application%2Fjson'

        $.ajax({
          password: geoserver_password,
          username: geoserver_username,
          url: testurl,
          type: 'GET',
          success: () => console.log('log in success'),
          error: (err) => console.err('log in not successful', err),
        })
      },
    })
  } else {
    hakaUser = false
    geoserver_username = ''
    geoserver_password = ''
  }
}
*/

function checkParameterDatasetAccess() {
  loadMetadata(() => {
    if (pageDataIdParam === null || pageDataIdParam.length == 0) {
      main()
    } else {
      /*
      TODO Haka

      const dataIdRow = alasql(
        "SELECT * FROM ? WHERE data_id='" + pageDataIdParam + "'",
        [metadata]
      )
      if (typeof dataIdRow[0] !== 'undefined') {
           if (dataIdRow[0].access == 2 && !hakaUser) {
               window.location.replace('https://' + window.location.host + '/c/portal/login?p_l_id= ' + Liferay.ThemeDisplay.getPlid());
           } else {
               main();
           }
      } else {
           main();
      }
      */
    }
  })
}

function loadMetadata(afterMetadataLoadCallback) {
  $.getJSON(METADATA_API, (data) => {
    metadata = data
    afterMetadataLoadCallback()
  })
}

function main() {
  String.prototype.insert = function (index, string) {
    if (index > 0)
      return (
        this.substring(0, index) + string + this.substring(index, this.length)
      )
    else return string + this
  }

  $(document).tooltip({ track: true })

  const selected_style = new style.Style({
    stroke: new style.Stroke({
      color: 'rgba(102, 178, 255, 1.0)',
      width: 3,
    }),
    fill: new style.Fill({
      color: [255, 255, 255, 0.4],
    }),
    image: new style.Circle({
      radius: 4,
      fill: new style.Fill({
        color: 'rgba(102, 178, 255, 1.0)',
      }),
    }),
  })

  const highlighted_style = new style.Style({
    stroke: new style.Stroke({
      color: 'rgba(255, 51, 204,1)',
      width: 8,
    }),
    fill: new style.Fill({
      color: [255, 255, 255, 0.8],
    }),
  })

  const translator = new Translator(currentLocale)

  const panSelectBtn = $('#panselection-button')
  const selectSelectContainer = $('#selectselection-container')
  const clearSelectContainer = $('#clearselection-container')
  const infoSelectContainer = $('#infoselection-container')
  const infoSelectBtn = $('#infoselection-button')
  const drawSelectContainer = $('#drawselection-container')
  selectSelectContainer.hide()
  clearSelectContainer.hide()
  infoSelectContainer.hide()
  drawSelectContainer.hide()

  const locationSearchInput = $('#location-search-input')

  let currentIndexMapLabelLayer = null
  let currentDataLayerSrc = null
  let currentDataLayer = null
  let currentDataId = null
  let currentDataUrl = null
  let currentMaxResolution = null

  let mapContainerId = 'map-container'

  // Etsin
  const ETSIN_BASE = '//metax.fairdata.fi' // "//metax-test.csc.fi" "//etsin.avointiede.fi" "//etsin-demo.avointiede.fi"
  const ETSIN_BASE_URN = 'http://urn.fi/' //
  const ETSIN_METADATA_JSON_BASE_URL =
    ETSIN_BASE + '/rest/datasets?format=json&preferred_identifier='

  // GeoServer
  const BASE_URL = '//avaa.tdata.fi/geoserver/' // "//avoin-test.csc.fi/geoserver/";
  const INDEX_LAYER = 'paituli:index'
  const LAYER_NAME_MUNICIPALITIES = 'paituli:mml_hallinto_2014_100k'
  const LAYER_NAME_CATCHMENT_AREAS = 'paituli:syke_valuma_maa'

  const WFS_INDEX_MAP_LAYER_URL =
    BASE_URL +
    'wfs?service=WFS&version=2.0.0&request=GetFeature&srsname=epsg:3857&typeNames=' +
    INDEX_LAYER +
    "&cql_filter= !key! = '!value!'"
  const WMS_INDEX_MAP_LABEL_LAYER_URL =
    BASE_URL +
    'wms?service=WMS&LAYERS= ' +
    INDEX_LAYER +
    "&CQL_FILTER=data_id = '!value!'"
  const WMS_PAITULI_BASE_URL = BASE_URL + 'wms?'
  const WMS_PAITULI_BASE_URL_GWC = BASE_URL + 'gwc/service/wms?'
  const WFS_INDEX_MAP_DOWNLOAD_SHAPE =
    BASE_URL +
    'wfs?service=WFS&version=2.0.0&request=GetFeature&srsname=epsg:4326&typeNames=' +
    INDEX_LAYER +
    "&outputFormat=shape-zip&propertyname=label,path,geom&cql_filter= !key! = '!value!'"

  // Location search
  const NOMINATIM_API_URL =
    '//nominatim.openstreetmap.org/search?format=json&q=!query!&addressdetails=0&limit=1'
  const MAX_DOWNLOADABLE_SIZE = 3000

  let prevSelectedTab = null

  let emailModal = null
  let emailForm = null
  let emailListModal = null
  let emailListForm = null

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  const emailInput = $('#email-input')
  const emailListInput = $('#email-list-input')
  const licenceCheckbox = $('#licence-checkbox')
  const licenceCheckboxList = $('#licence-list-checkbox')
  const tips = $('#email-modal-tips')
  const listTips = $('#email-list-modal-tips')

  let fileList = []
  let fileLabelList = []

  function updateModalTips(t, tipsOutput) {
    tipsOutput.text(t).addClass('ui-state-highlight')
    setTimeout(() => tipsOutput.removeClass('ui-state-highlight', 1500), 500)
  }

  function checkLength(obj, min, max, errMsg, tipsOutput) {
    if (obj.val().length > max || obj.val().length < min) {
      obj.addClass('ui-state-error')
      updateModalTips(errMsg, tipsOutput)
      return false
    } else {
      return true
    }
  }

  function checkRegexp(obj, regexp, errMsg, tipsOutput) {
    if (!regexp.test(obj.val())) {
      obj.addClass('ui-state-error')
      updateModalTips(errMsg, tipsOutput)
      return false
    } else {
      return true
    }
  }

  function checkIsChecked(obj, errMsg, tipsOutput) {
    if (!obj.prop('checked')) {
      obj.addClass('ui-state-error')
      updateModalTips(errMsg, tipsOutput)
      return false
    } else {
      return true
    }
  }

  function emailDataOrList(input, dlType, licence, modal, tipsOutput) {
    const emailVal = input.val()
    if (fileList && fileList.length > 0 && emailVal) {
      const downloadRequest = {
        data_id: currentDataId,
        downloadType: dlType.toUpperCase(),
        email: emailVal,
        language: currentLocale,
        filePaths: fileList,
        filenames: fileLabelList,
        org: getCurrentLayerData('org'),
        data: getCurrentLayerData('name'),
        scale: getCurrentLayerData('scale'),
        year: getCurrentLayerData('year'),
        coord_sys: getCurrentLayerData('coord_sys'),
        format: getCurrentLayerData('format'),
      }

      // Validate input fields
      let valid = true
      input.removeClass('ui-state-error')
      licence.removeClass('ui-state-error')
      valid =
        valid &&
        checkLength(
          input,
          1,
          80,
          translator.getVal('email.errorEmailLength'),
          tipsOutput
        )
      valid =
        valid &&
        checkRegexp(
          input,
          emailRegex,
          translator.getVal('email.errorEmailFormat'),
          tipsOutput
        )
      valid =
        valid &&
        checkIsChecked(
          licence,
          translator.getVal('email.errorCheckboxChecked'),
          tipsOutput
        )

      if (valid) {
        modal.data('email', input.val())
        $.post({
          url: GENERATE_PACKAGE_API_URL,
          data: JSON.stringify(downloadRequest),
          contentType: 'application/json; charset=utf-8',
          dataType: 'json',
          success: () => modal.dialog('close'),
        })
      }
      return valid
    } else {
      console.error('No email or file paths defined!')
      return false
    }
  }

  function emailData() {
    return emailDataOrList(emailInput, 'zip', licenceCheckbox, emailModal, tips)
  }

  function emailList() {
    return emailDataOrList(
      emailListInput,
      'list',
      licenceCheckboxList,
      emailListModal,
      listTips
    )
  }

  emailModal = $('#email-modal').dialog({
    autoOpen: false,
    height: 'auto',
    width: 600,
    modal: true,
    closeOnEscape: true,
    draggable: true,
    resizable: false,
    title: translator.getVal('email.modalheader'),
    buttons: [
      {
        text: translator.getVal('email.sendButton'),
        icons: {
          primary: 'ui-icon-mail-closed',
        },
        click: emailData,
        type: 'submit',
      },
      {
        text: translator.getVal('email.cancelButton'),
        icons: {
          primary: 'ui-icon-close',
        },
        click: () => $(this).dialog('close'),
      },
    ],
    close: () => {
      emailForm[0].reset()
      emailInput.removeClass('ui-state-error')
      licenceCheckbox.removeClass('ui-state-error')
    },
  })

  emailForm = emailModal.find('form')
  emailForm.on('submit', (event) => {
    event.preventDefault()
    emailData()
  })

  emailListModal = $('#email-list-modal').dialog({
    autoOpen: false,
    height: 'auto',
    width: 600,
    modal: true,
    closeOnEscape: true,
    draggable: true,
    resizable: false,
    title: translator.getVal('email.modalheaderList'),
    buttons: [
      {
        text: translator.getVal('email.sendButtonList'),
        icons: {
          primary: 'ui-icon-mail-closed',
        },
        click: emailList,
        type: 'submit',
      },
      {
        text: translator.getVal('email.cancelButton'),
        icons: {
          primary: 'ui-icon-close',
        },
        click: () => emailListModal.dialog('close'),
      },
    ],
    close: () => {
      emailListForm[0].reset()
      emailListInput.removeClass('ui-state-error')
      licenceCheckboxList.removeClass('ui-state-error')
    },
  })
  emailListForm = emailListModal.find('form')
  emailListForm.on('submit', (event) => {
    event.preventDefault()
    emailList()
  })

  function setHtmlElementTextValues() {
    $('#dl-service-header h1').text(translator.getVal('appHeader'))
    $('#data-form legend').text(translator.getVal('data.header'))
    $('#resetview-button').attr('title', translator.getVal('map.reset'))
    $('#clearselection-button').attr(
      'title',
      translator.getVal('map.clearSelection')
    )
    $('#panselection-button').attr('title', translator.getVal('map.pan'))
    $('#selectselection-button').attr('title', translator.getVal('map.select'))
    $('#infoselection-button').attr('title', translator.getVal('map.info'))
    $('#drawselection-button').attr('title', translator.getVal('map.draw'))

    $('#download-container-anchor').text(translator.getVal('info.downloadtab'))
    $('#feature-info-container-anchor').text(
      translator.getVal('info.featureinfotab')
    )
    $('#metadata-container-anchor').text(translator.getVal('info.metadatatab'))
    $('#links-container-anchor').text(translator.getVal('info.linkstab'))
    locationSearchInput.attr(
      'placeholder',
      translator.getVal('map.locationsearch')
    )
    $('#email-input-label').text(translator.getVal('email.emailfield'))
    $('#email-input').attr(
      'placeholder',
      translator.getVal('email.emailfieldPlaceholder')
    )
    $('#email-modal-form fieldset legend').text(
      translator.getVal('email.inputsheader')
    )
    $('#email-instructions').text(translator.getVal('email.info'))

    $('#email-list-input-label').text(translator.getVal('email.emailfield'))
    $('#email-list-input').attr(
      'placeholder',
      translator.getVal('email.emailfieldPlaceholder')
    )
    $('#email-list-modal-form fieldset legend').text(
      translator.getVal('email.inputsheader')
    )
    $('#email-list-instructions').text(translator.getVal('email.info'))
  }

  setHtmlElementTextValues()
  const tabContainerId = 'info-container'
  const tabContainer = $('#' + tabContainerId)
  const downloadTabContentRootId = 'download-container'
  const downloadTabContentRoot = $('#' + downloadTabContentRootId)
  const featureInfoTabContentRootId = 'feature-info-container'
  const featureInfoTabContentRoot = $('#' + featureInfoTabContentRootId)
  const metadataTabContentRootId = 'metadata-container'
  const metadataTabContentRoot = $('#' + metadataTabContentRootId)
  const linksTabContentRootId = 'links-container'
  const linksTabContentRoot = $('#' + linksTabContentRootId)
  tabContainer.tabs({
    activate: (event, ui) => (prevSelectedTab = ui.newPanel.get(0).id),
  })

  function strStartsWith(str, prefix) {
    return str.indexOf(prefix) === 0
  }

  function setInfoContent(contentType, params) {
    switch (contentType) {
      case 'download':
        createDownloadContent(downloadTabContentRoot)
        break
      case 'featureinfo':
        clearFeatureInfoTabContent()
        createFeatureInfoContent(featureInfoTabContentRoot, params)
        break
      case 'metadata':
        clearMetadataTabContent()
        createMetadataTabContent()
        break
      case 'links':
        createLinksContent(linksTabContentRoot)
        break
      default:
        break
    }
  }

  const featureSearchContainer = $('#feature-search-container')

  function createSearchField() {
    const searchBtn = $('<a>', {
      class: 'btn btn-default',
      id: 'search-button',
      href: '',
    })
    searchBtn.text(translator.getVal('data.search'))
    searchBtn.on('click', searchFeatures)

    const searchField = $('<input>', {
      id: 'feature-search-field',
      type: 'search',
    })
    searchField.keyup((event) => {
      if (event.keyCode == 13) {
        searchBtn.click()
        event.target.blur()
      }
    })
    searchField.focus(() => clearSearchResults())

    const searchResults = $('<div>', {
      id: 'feature-search-results',
    })

    searchField.appendTo(featureSearchContainer)
    searchBtn.appendTo(featureSearchContainer)
    searchResults.appendTo(featureSearchContainer)
  }

  function searchFeatures() {
    const searchStr = $('#feature-search-field').val()
    if (searchStr !== null && searchStr.length > 0) {
      clearMapFeatureSelection()
      clearSearchResults()
      const features = getSearchResultFeatures(searchStr)
      selectedFeatures.extend(features)
      $('#feature-search-results').text(
        translator
          .getVal('data.searchresult')
          .replace('!features!', features.length)
      )

      setInfoContent('download')
    }
    return false
  }

  function createFeatureInfoContent(rootElem, event) {
    const viewResolution = view.getResolution()
    const url = currentDataLayerSrc.getGetFeatureInfoUrl(
      event.coordinate,
      viewResolution,
      'EPSG:3857',
      { INFO_FORMAT: 'text/plain', outputFormat: 'text/javascript' }
    )
    if (url) {
      rootElem.html(
        '<iframe id="feature-info-iframe" seamless src="' + url + '"></iframe>'
      )
    }
  }

  function addLink(linkName, hrefValue, container) {
    let anchor = $('#' + linkName + '-anchor')
    if (!anchor.length) {
      anchor = $('<a>', {
        id: 'dataset-link-anchor',
        href: hrefValue,
        target: '_blank',
      })
    }
    container.append('<strong>' + linkName + ': </strong>')
    anchor.text(hrefValue)
    anchor.appendTo(container)
    container.append('<br>')
  }

  function createParagraph(id, text) {
    let p = $(id)
    if (!p.length) {
      p = $('<p>', {
        id: id,
      })
    }
    p.text(text)
    return p
  }

  function createLinksContent(rootElem) {
    rootElem.empty()
    const infoText = createParagraph(
      '#links-info',
      translator.getVal('info.linksIntro')
    )
    infoText.appendTo(rootElem)

    const datasetPath = getCurrentLayerData('funet')
    const rsyncPath =
      'rsync://rsync.nic.funet.fi/ftp/index/geodata/' + datasetPath

    const linksContainer = $('<div>', {
      id: 'links-container',
    })

    const ftpPath = 'ftp://ftp.funet.fi/index/geodata/' + datasetPath
    const httpPath = 'http://www.nic.funet.fi/index/geodata/' + datasetPath

    addLink('http', httpPath, linksContainer)
    addLink('ftp', ftpPath, linksContainer)
    linksContainer.append('<strong>rsync: </strong>' + rsyncPath)
    linksContainer.appendTo(rootElem)

    const url = WFS_INDEX_MAP_DOWNLOAD_SHAPE.replace(
      '!key!',
      'data_id'
    ).replace('!value!', currentDataId)

    let index_anchor = $('#index-anchor')
    if (!index_anchor.length) {
      index_anchor = $('<a>', {
        id: 'index-anchor',
        href: url,
        target: '_blank',
      })
    }
    index_anchor.text(translator.getVal('info.downloadindex') + ' ')

    $('<br>').appendTo(rootElem)
    rootElem.append(index_anchor)
    rootElem.append(translator.getVal('info.dlIndexMapInfo') + ' ')
    rootElem.append(
      translator
        .getVal('info.linksInfo')
        .replace('!infolink!', 'https://avaa.tdata.fi/web/paituli/ftp-/-rsync')
    )
  }

  function createDownloadContent(rootElem) {
    // Download and download list buttons are inside wrappers so that
    // tooltips can be attached to wrappers instead of buttons. This way
    // tooltips retain constant style even when buttons are disabled.
    highlightOverlay.getSource().clear()

    let dlButtonWrapper = $('#dl-button-wrapper')
    if (!dlButtonWrapper.length) {
      dlButtonWrapper = $('<a>', { id: 'dl-button-wrapper' })
    }
    let dlButton = $('#download-button')
    if (!dlButton.length) {
      dlButton = $('<button>', {
        class: 'btn btn-default',
        id: 'download-button',
      })
    }
    dlButton.text(
      translator.getVal('info.download') +
        ': ~' +
        getTotalDownloadSize() +
        ' Mb'
    )
    dlButton.appendTo(dlButtonWrapper)

    let dlListWrapper = $('#dl-list-wrapper')
    if (!dlListWrapper.length) {
      dlListWrapper = $('<a>', {
        id: 'dl-list-wrapper',
        title: translator.getVal('info.dlListTooltip'),
      })
    }
    let dlListButton = $('#download-list-button')
    if (!dlListButton.length) {
      dlListButton = $('<button>', {
        class: 'btn btn-default',
        id: 'download-list-button',
      })
    }
    dlListButton.text(translator.getVal('info.downloadlist'))
    dlListButton.appendTo(dlListWrapper)

    // Hide files list download option, if HAKA-dataset, these are not in FTP.
    const dataAccess = getCurrentLayerData('access')
    if (dataAccess == 1) {
      dlListButton.css('visibility', 'visible')
    } else {
      dlListButton.css('visibility', 'hidden')
    }

    let licenceHeader = $('#download-licence-header')
    if (!licenceHeader.length) {
      licenceHeader = $('<h5>', {
        id: 'download-licence-header',
        class: 'download-tab-header',
      })
    }
    licenceHeader.text(translator.getVal('info.documents'))

    //http://www.nic.funet.fi/index/geodata/mml/NLS_terms_of_use.pdf -> crop after geodata/
    const licenceUrl = getCurrentLayerData('license_url')
    const dlLicInputId = 'download-licence-input'
    let dlLicContainer = $('#download-licence-container')
    let dlLicInput = $('#' + dlLicInputId)
    let dlLicLabelLink = $('#download-licence-link')
    if (!dlLicInput.length) {
      dlLicContainer = $('<div>', {
        id: 'download-licence-container',
      })
      dlLicLabelLink = $('<a>', {
        id: 'download-licence-link',
        href: licenceUrl,
        target: '_blank',
        class: 'download-licence-link',
        'data-value': translator.getVal('info.licence'),
      })
      dlLicLabelLink.text(translator.getVal('info.licence'))
      dlLicInput = $('<input>', {
        checked: 'checked',
        id: dlLicInputId,
        type: 'checkbox',
        value: cutLicenseURL(licenceUrl),
        class: 'download-checkbox',
      })
      dlLicInput.appendTo(dlLicContainer)
      dlLicLabelLink.appendTo(dlLicContainer)
    }

    const downloadFilesHeader = $('<h5>', {
      id: 'download-file-header',
      class: 'download-tab-header',
    })
    downloadFilesHeader.text(translator.getVal('info.files'))

    if (selectedFeatures.getLength() > 0) {
      let dataListContainerElem = $('#data-download-list')
      if (!dataListContainerElem.length) {
        clearDownloadTabContent()
        dlButtonWrapper.appendTo(rootElem)
        dlListWrapper.appendTo(rootElem)
        licenceHeader.appendTo(rootElem)

        dlLicContainer.appendTo(rootElem)

        downloadFilesHeader.appendTo(rootElem)
      }

      if (!dataListContainerElem.length) {
        dataListContainerElem = $('<div>', {
          id: 'data-download-list',
        })
      } else {
        dataListContainerElem.empty()
      }

      let i = 0
      fileLabelList = []
      const dlLabelList = []

      selectedFeatures.forEach((feature) => {
        const label = feature.get('label')
        fileLabelList.push(label)
        const filePath = feature.get('path')
        i += 1
        const inputId = 'download-file-input-' + i.toString()
        const dlLabel = $('<label>', {
          for: inputId,
          class: 'download-label',
          'data-value': label,
          ol_id: feature.getId(),
        })
        const dlInput = $('<input>', {
          checked: 'checked',
          id: inputId,
          type: 'checkbox',
          value: filePath,
          class: 'download-checkbox',
          ol_id: feature.getId(),
        })
        dlInput.on('change', () => {
          updateSelectedFeatures(feature, dlInput)
          updateDownloadFileList(
            dlButton,
            dlButtonWrapper,
            dlListButton,
            dlLicInput
          )
        })
        dlLabel.hover(
          (event) => {
            highlightOverlay.getSource().clear()
            const feature = currentIndexMapLayer
              .getSource()
              .getFeatureById($(event.target).attr('ol_id'))
            highlightOverlay.getSource().addFeature(feature)
            dlLabel.css('font-weight', 'Bold')
          },
          (event) => {
            const feature = currentIndexMapLayer
              .getSource()
              .getFeatureById($(event.target).attr('ol_id'))
            highlightOverlay.getSource().removeFeature(feature)
            dlLabel.css('font-weight', 'normal')
          }
        )
        dlLabel.append(dlInput)
        dlLabel.append(label)
        dlLabelList.push(dlLabel)
      })
      dlLabelList.sort((a, b) => {
        if (a.attr('data-value') >= b.attr('data-value')) {
          return 1
        } else {
          return -1
        }
      })
      $.each(dlLabelList, (idx, val) => val.appendTo(dataListContainerElem))
      if (i > 0) {
        dataListContainerElem.appendTo(rootElem)
      }
    } else {
      clearDownloadTabContent()
      dlButtonWrapper.appendTo(rootElem)
      dlListWrapper.appendTo(rootElem)
      licenceHeader.appendTo(rootElem)
      dlLicContainer.appendTo(rootElem)
      downloadFilesHeader.appendTo(rootElem)
      const downloadInfo = $('<div>', {
        id: 'download-info-container',
      })
      downloadInfo.text(translator.getVal('info.info'))
      downloadInfo.appendTo(rootElem)
    }
    dlLicInput.on('change', () => {
      updateDownloadFileList(
        dlButton,
        dlButtonWrapper,
        dlListButton,
        dlLicInput
      )
      updateFileLabelListForLicence(dlLicInput, licenceUrl)
    })
    dlButton.on('click', (event) => {
      event.preventDefault()
      event.stopImmediatePropagation()
      updateEmailModal()
      $('#email-modal-tips').empty()
      $('#email-input').val(
        emailModal.data('email') === null ? '' : emailModal.data('email')
      )
      if (
        dlLicInput.prop('checked') ? fileList.length > 1 : fileList.length > 0
      ) {
        emailModal.dialog('open')
      }
    })
    dlListButton.on('click', (event) => {
      event.preventDefault()
      event.stopImmediatePropagation()
      updateEmailListModal()
      $('#email-list-modal-tips').empty()
      $('#email-list-input').val(
        emailListModal.data('email') === null
          ? ''
          : emailListModal.data('email')
      )
      if (
        dlLicInput.prop('checked') ? fileList.length > 1 : fileList.length > 0
      ) {
        emailListModal.dialog('open')
      }
    })
    updateDownloadFileList(dlButton, dlButtonWrapper, dlListButton, dlLicInput)
    updateFileLabelListForLicence(dlLicInput, licenceUrl)
  }

  function updateFileLabelListForLicence(dlLicInput, licenceUrl) {
    const licenceIdx = fileLabelList.indexOf(licenceUrl)
    if (dlLicInput.prop('checked')) {
      if (licenceIdx == -1) {
        fileLabelList.push(licenceUrl)
      }
    } else {
      if (licenceIdx > -1) {
        fileLabelList.splice(licenceIdx, 1)
      }
    }
  }

  function updateDownloadFileList(
    dlButton,
    dlButtonWrapper,
    dlListButton,
    dlLicInput
  ) {
    fileList = []
    const markedForDownload = $('.download-checkbox:checked')
    markedForDownload.each((i, checkbox) => fileList.push(checkbox.value))

    updateDownloadButton(dlButton, dlButtonWrapper, dlLicInput)
    updateDownloadListButton(dlListButton, dlLicInput)
  }

  function updateDownloadButton(dlButton, dlButtonWrapper, dlLicInput) {
    dlButton.text(
      translator.getVal('info.download') +
        ': ~' +
        getTotalDownloadSize() +
        ' Mb'
    )
    if (
      (dlLicInput.prop('checked')
        ? fileList.length > 1
        : fileList.length > 0) &&
      getTotalDownloadSize() <= MAX_DOWNLOADABLE_SIZE
    ) {
      dlButton.prop('disabled', false)
      dlButtonWrapper.removeAttr('title')
    } else {
      if (getTotalDownloadSize() > MAX_DOWNLOADABLE_SIZE) {
        dlButtonWrapper.attr('title', translator.getVal('info.downloadTooltip'))
      }
      dlButton.prop('disabled', true)
    }
  }

  function updateDownloadListButton(dlListButton, dlLicInput) {
    if (
      dlLicInput.prop('checked') ? fileList.length > 1 : fileList.length > 0
    ) {
      dlListButton.prop('disabled', false)
    } else {
      dlListButton.prop('disabled', true)
    }
  }

  function updateSelectedFeatures(clickedFeature, dlInput) {
    if (dlInput.is(':checked')) {
      selectedFeatures.push(clickedFeature)
    } else {
      selectedFeatures.remove(clickedFeature)
    }
  }

  function updateModal(dataDescription, licenceCheckboxLabel) {
    const dataDescrContainer = $(dataDescription)
    dataDescrContainer.empty()

    $(licenceCheckboxLabel).html(
      translator
        .getVal('email.licencefield')
        .replace('!licence!', getCurrentLayerData('license_url'))
    )
    const dataDescrContent = $('<div>')
    dataDescrContent.text(
      translator.getVal('email.datasetinfo') +
        ': ' +
        getCurrentLayerData('org') +
        ', ' +
        getCurrentLayerData('name') +
        ', ' +
        getCurrentLayerData('scale') +
        ', ' +
        getCurrentLayerData('year') +
        ', ' +
        getCurrentLayerData('coord_sys') +
        ', ' +
        getCurrentLayerData('format') +
        ': ' +
        getTotalDownloadSize() +
        ' Mb'
    )
    dataDescrContent.appendTo(dataDescrContainer)
  }

  function updateEmailModal() {
    updateModal('#data-description', '#licence-checkbox-label')
  }

  function updateEmailListModal() {
    updateModal('#data-description-list', '#licence-list-checkbox-label')
  }

  function clearFeatureInfoTabContent() {
    featureInfoTabContentRoot.empty()
  }

  function clearDownloadTabContent() {
    downloadTabContentRoot.empty()
  }

  function clearMetadataTabContent() {
    metadataTabContentRoot.empty()
  }

  function clearInfoBoxTabs() {
    clearDownloadTabContent()
    clearFeatureInfoTabContent()
  }

  function selectTab(tabIndex) {
    tabContainer.tabs('option', 'active', tabIndex)
  }

  function selectTabAfterDatasetChange(hasInfoTab) {
    if (prevSelectedTab == null) {
      prevSelectedTab = downloadTabContentRootId
    }

    let newTabId = null
    if (prevSelectedTab == downloadTabContentRootId) {
      newTabId = downloadTabContentRootId
    } else if (prevSelectedTab == featureInfoTabContentRootId) {
      if (hasInfoTab) {
        newTabId = featureInfoTabContentRootId
      } else {
        newTabId = downloadTabContentRootId
      }
    } else if (prevSelectedTab == metadataTabContentRootId) {
      newTabId = metadataTabContentRootId
    }
    const index = $('#' + tabContainerId + ' a[href="#' + newTabId + '"]')
      .parent()
      .index()
    $('#' + tabContainerId).tabs('option', 'active', index)
  }

  function clearSearchResults() {
    $('#feature-search-field').val('')
    $('#feature-search-results').empty()
  }

  function initFormInputs(formRootElemId) {
    const producerInputId = 'producer-input'
    const dataInputId = 'data-input'
    const scaleInputId = 'scale-input'
    const yearInputId = 'year-input'
    const formatInputId = 'format-input'
    const coordsysInputId = 'coordsys-input'
    const rootElem = $('#' + formRootElemId)

    const producerInputRow = $('<article>', {
      class: 'form-input-row',
      id: 'producer-row',
    })
    const producerLabel = $('<div>', {
      class: 'form-input-label',
      id: 'producer-label',
    })
    producerLabel.append(translator.getVal('data.producer'))

    const producerInput = $('<select>', {
      class: 'form-input',
      id: producerInputId,
    })
    producerLabel.appendTo(producerInputRow)
    producerInput.appendTo(producerInputRow)

    const dataInputRow = $('<article>', {
      class: 'form-input-row',
      id: 'data-row',
    })
    const dataLabel = $('<div>', {
      class: 'form-input-label',
      id: 'data-label',
    })
    dataLabel.append(translator.getVal('data.data'))

    const dataInput = $('<select>', {
      class: 'form-input',
      id: dataInputId,
    })
    dataLabel.appendTo(dataInputRow)
    dataInput.appendTo(dataInputRow)

    const scaleInputRow = $('<article>', {
      class: 'form-input-row',
      id: 'scale-row',
    })
    const scaleLabel = $('<div>', {
      class: 'form-input-label',
      id: 'scale-label',
    })
    scaleLabel.append(translator.getVal('data.scale'))
    const scaleInput = $('<select>', {
      class: 'form-input',
      id: scaleInputId,
    })
    scaleLabel.appendTo(scaleInputRow)
    scaleInput.appendTo(scaleInputRow)

    const yearInputRow = $('<article>', {
      class: 'form-input-row',
      id: 'year-row',
    })
    const yearLabel = $('<div>', {
      class: 'form-input-label',
      id: 'year-label',
    })
    yearLabel.append(translator.getVal('data.year'))
    const yearInput = $('<select>', {
      class: 'form-input',
      id: yearInputId,
    })
    yearLabel.appendTo(yearInputRow)
    yearInput.appendTo(yearInputRow)

    const formatInputRow = $('<article>', {
      class: 'form-input-row',
      id: 'format-row',
    })
    const formatLabel = $('<div>', {
      class: 'form-input-label',
      id: 'format-label',
    })
    formatLabel.append(translator.getVal('data.format'))
    const formatInput = $('<select>', {
      class: 'form-input',
      id: formatInputId,
    })
    formatLabel.appendTo(formatInputRow)
    formatInput.appendTo(formatInputRow)

    const coordsysInputRow = $('<article>', {
      class: 'form-input-row',
      id: 'coordsys-row',
    })
    const coordsysLabel = $('<div>', {
      class: 'form-input-label',
      id: 'coordsys-label',
    })
    coordsysLabel.append(translator.getVal('data.coordSys'))
    const coordsysInput = $('<select>', {
      class: 'form-input',
      id: coordsysInputId,
    })
    coordsysLabel.appendTo(coordsysInputRow)
    coordsysInput.appendTo(coordsysInputRow)

    producerInputRow.appendTo(rootElem)
    dataInputRow.appendTo(rootElem)
    scaleInputRow.appendTo(rootElem)
    yearInputRow.appendTo(rootElem)
    formatInputRow.appendTo(rootElem)
    coordsysInputRow.appendTo(rootElem)

    $('#' + producerInputId).on('change', () =>
      updateDataList(producerInput, dataInput)
    )
    $('#' + dataInputId).on('change', () =>
      updateScaleList(producerInput, dataInput, scaleInput)
    )
    $('#' + scaleInputId).on('change', () =>
      updateYearList(producerInput, dataInput, scaleInput, yearInput)
    )
    $('#' + yearInputId).on('change', () =>
      updateFormatList(
        producerInput,
        dataInput,
        scaleInput,
        yearInput,
        formatInput
      )
    )
    $('#' + formatInputId).on('change', () =>
      updateCoordsysList(
        producerInput,
        dataInput,
        scaleInput,
        yearInput,
        formatInput,
        coordsysInput
      )
    )
    $('#' + coordsysInputId).on('change', () => {
      const selectedProducer = producerInput.val()
      const selectedData = dataInput.val()
      const selectedScale = scaleInput.val()
      const selectedYear = yearInput.val()
      const selectedFormat = formatInput.val()
      const selectedCoordsys = coordsysInput.val()
      const dataIdResult = alasql(
        "SELECT data_id FROM ? WHERE org='" +
          selectedProducer +
          "' AND name='" +
          selectedData +
          "' AND scale='" +
          selectedScale +
          "' AND year='" +
          selectedYear +
          "' AND format='" +
          selectedFormat +
          "' AND coord_sys='" +
          selectedCoordsys +
          "'",
        [metadata]
      ).map((item) => item.data_id)
      if (typeof dataIdResult[0] !== 'undefined') {
        currentDataId = dataIdResult[0]
        const dataUrl = getCurrentLayerData('data_url')

        if (dataUrl !== null) {
          currentDataUrl = dataUrl
        } else {
          currentDataUrl = null
        }
      } else {
        currentDataId = null
      }
      updateMap()
    })

    createSearchField()

    if (pageDataIdParam !== null) {
      updateProducerList(producerInput)
      setDataIdVars(
        producerInput,
        dataInput,
        scaleInput,
        yearInput,
        formatInput,
        coordsysInput
      )
    } else {
      updateProducerList(producerInput)
    }
  }

  function setDataIdVars(
    producerInput,
    dataInput,
    scaleInput,
    yearInput,
    formatInput,
    coordsysInput
  ) {
    const dataIdRow = alasql(
      "SELECT * FROM ? WHERE data_id='" + pageDataIdParam + "'",
      [metadata]
    )
    if (typeof dataIdRow[0] !== 'undefined') {
      const producer = dataIdRow[0].org
      const dataName = dataIdRow[0].name
      const scale = dataIdRow[0].scale
      const year = dataIdRow[0].year
      const format = dataIdRow[0].format
      const coordsys = dataIdRow[0].coord_sys
      producerInput.val(producer)
      producerInput.trigger('change')
      dataInput.val(dataName)
      dataInput.trigger('change')
      scaleInput.val(scale)
      scaleInput.trigger('change')
      yearInput.val(year)
      yearInput.trigger('change')
      formatInput.val(format)
      formatInput.trigger('change')
      coordsysInput.val(coordsys)
      coordsysInput.trigger('change')
    }
    pageDataIdParam = null
  }

  function updateProducerList(producerInput) {
    // hakaUser = Liferay.ThemeDisplay.isSignedIn();
    const query = hakaUser
      ? 'SELECT DISTINCT org FROM ? '
      : 'SELECT DISTINCT org FROM ? WHERE access=1'
    const producers = alasql(query, [metadata]).map((item) => item.org)
    updateOptions(producerInput, sortDropdownData('ascending', producers), true)
  }

  function updateDataList(producerInput, dataInput) {
    const selectedProducerId = producerInput.val()
    if (!strStartsWith(selectedProducerId, '--')) {
      const data = hakaUser
        ? alasql(
            "SELECT name FROM ? WHERE org='" +
              selectedProducerId +
              "' GROUP BY name",
            [metadata]
          )
        : alasql(
            "SELECT name FROM ? WHERE org='" +
              selectedProducerId +
              "' AND access=1 GROUP BY name",
            [metadata]
          )
      const dataNames = sortDropdownData(
        'ascending',
        $.map(data, (item) => item.name)
      )
      updateOptions(dataInput, dataNames, false)
    } else {
      addEmptyOption(dataInput)
    }
  }

  function updateScaleList(producerInput, dataInput, scaleInput) {
    const selectedProducerId = producerInput.val()
    const selectedDataId = dataInput.val()
    if (!strStartsWith(selectedDataId, '--')) {
      const scales = alasql(
        "SELECT DISTINCT scale FROM ? WHERE org='" +
          selectedProducerId +
          "' AND name='" +
          selectedDataId +
          "'",
        [metadata]
      ).map((item) => item.scale)
      updateOptions(scaleInput, sortDropdownData('shortest', scales), false)
    } else {
      addEmptyOption(scaleInput)
    }
  }

  function updateYearList(producerInput, dataInput, scaleInput, yearInput) {
    const selectedProducerId = producerInput.val()
    const selectedDataId = dataInput.val()
    const selectedScaleId = scaleInput.val()
    if (!strStartsWith(selectedScaleId, '--')) {
      const years = alasql(
        "SELECT DISTINCT year FROM ? WHERE org='" +
          selectedProducerId +
          "' AND name='" +
          selectedDataId +
          "' AND scale='" +
          selectedScaleId +
          "'",
        [metadata]
      ).map((item) => item.year)
      updateOptions(yearInput, sortDropdownData('newest', years), false)
    } else {
      addEmptyOption(yearInput)
    }
  }

  function updateFormatList(
    producerInput,
    dataInput,
    scaleInput,
    yearInput,
    formatInput
  ) {
    const selectedProducerId = producerInput.val()
    const selectedDataId = dataInput.val()
    const selectedScaleId = scaleInput.val()
    const selectedYearId = yearInput.val()
    if (!strStartsWith(selectedYearId, '--')) {
      const formats = alasql(
        "SELECT DISTINCT format FROM ? WHERE org='" +
          selectedProducerId +
          "' AND name='" +
          selectedDataId +
          "' AND scale='" +
          selectedScaleId +
          "' AND year='" +
          selectedYearId +
          "'",
        [metadata]
      ).map((item) => item.format)
      updateOptions(formatInput, sortDropdownData('ascending', formats), false)
    } else {
      addEmptyOption(formatInput)
    }
  }

  function updateCoordsysList(
    producerInput,
    dataInput,
    scaleInput,
    yearInput,
    formatInput,
    coordsysInput
  ) {
    const selectedProducerId = producerInput.val()
    const selectedDataId = dataInput.val()
    const selectedScaleId = scaleInput.val()
    const selectedYearId = yearInput.val()
    const selectedFormatId = formatInput.val()
    if (!strStartsWith(selectedFormatId, '--')) {
      const coordsyses = alasql(
        "SELECT DISTINCT coord_sys FROM ? WHERE org='" +
          selectedProducerId +
          "' AND name='" +
          selectedDataId +
          "' AND scale='" +
          selectedScaleId +
          "' AND year='" +
          selectedYearId +
          "' AND format='" +
          selectedFormatId +
          "'",
        [metadata]
      ).map((item) => item.coord_sys)
      updateOptions(
        coordsysInput,
        sortDropdownData('ascending', coordsyses),
        false
      )
    } else {
      addEmptyOption(coordsysInput)
    }
  }

  function addEmptyOption(inputElem) {
    inputElem.empty()
    const title = '--'
    const optionElem = $('<option>', {
      value: title,
    })
    optionElem.text(title)
    inputElem.append(optionElem)
    inputElem.prop('disabled', true)
    inputElem
      .val($('#' + inputElem.attr('id') + ' option:first').val())
      .change()
  }

  function updateOptions(inputElem, optionNames, isProducerInput, optionIds) {
    if (optionIds === undefined) {
      optionIds = null
    }
    inputElem.empty()
    inputElem.prop('disabled', false)
    if (isProducerInput) {
      let title = null
      if (currentLocale == FINNISH_LANGUAGE) {
        title = '--Valitse aineistotuottaja--'
      } else if (currentLocale == ENGLISH_LANGUAGE) {
        title = '--Select data producer--'
      }
      const optionElem = $('<option>', {
        value: title,
      })
      optionElem.text(title)
      inputElem.append(optionElem)
    }
    $.each(optionNames, (idx, value) => {
      const optionElem = $('<option>', {
        value: value,
      })
      optionElem.text(value)
      if (optionIds !== null) {
        optionElem.attr('id', optionIds[idx])
      }
      inputElem.append(optionElem)
    })

    if (inputElem.find('option').length <= 1) {
      inputElem.prop('disabled', true)
    }

    inputElem
      .val($('#' + inputElem.attr('id') + ' option:first').val())
      .change()
  }

  function sortDropdownData(type, data) {
    switch (type) {
      case 'ascending':
        data.sort()
        break
      case 'newest': // Used for dates
        data.sort((a, b) => {
          const c = fixDropDownItemForOrdering(a)
          const d = fixDropDownItemForOrdering(b)
          return d - c
        })
        break

      case 'shortest':
        // Used for scales
        // The scales are basicallly ordered in numeric order from smaller
        // to bigger.

        data.sort((a, b) => {
          const c = fixDropDownItemForOrdering(a)
          const d = fixDropDownItemForOrdering(b)
          return c - d
        })
        break
      default:
        return null
    }
    return data
  }

  function fixDropDownItemForOrdering(label) {
    let d
    // Split is for cases like: 1:10 000, 25mx25m, "1:20 000, 1:50 000",
    // 2015-2017.
    // Count only with the last number.
    if (label.search(/[?,:.xX-]+/) != -1) {
      let parts = label.split(/[?,:.xX-]+/g)
      d = parts[parts.length - 1]
    } else {
      d = label
    }
    // Remove anything non-numeric
    d = d.replace(/\D/g, '')
    return d
  }

  function createMetadataTabContent() {
    const metadataURN = getCurrentLayerData('meta')
    const metadataInfoLabel = $('<div>', {
      id: 'metadata-info-label',
    })
    if (metadataURN !== null) {
      const metadataBaseUrl = ETSIN_BASE_URN
      metadataInfoLabel.append(
        translator
          .getVal('info.metadatainfo')
          .replace('!metadata_url!', metadataBaseUrl + flipURN(metadataURN))
      )
      metadataTabContentRoot.append(metadataInfoLabel)
    }

    const metadataNotes = $('<div>', {
      id: 'metadata-notes',
    })

    const errorFunction = (metadataNotes) => {
      metadataNotes.html(translator.getVal('info.nometadataavailable'))
      metadataTabContentRoot.append(metadataNotes)
    }

    const successFunction = (rawEtsinMetadata, metadataNotes) => {
      const notesHtml = getNotesAsHtmlFromEtsinMetadata(rawEtsinMetadata)
      const linksHtml = getLinksAsHtmlFromEtsinMetadata(rawEtsinMetadata)
      if (rawEtsinMetadata == null || notesHtml == null) {
        metadataNotes.html(translator.getVal('info.nometadataavailable'))
      } else {
        metadataNotes.html(
          translator.getVal('info.metadatacontentheader') +
            notesHtml +
            linksHtml
        )
      }
      if (metadataTabContentRoot.children().length >= 2) {
        metadataTabContentRoot.children().last().remove()
      }
      metadataTabContentRoot.append(metadataNotes)
    }

    fetchMetadataDescription(
      metadataURN,
      metadataNotes,
      successFunction,
      errorFunction
    )
  }

  // Get dataset's metadata file links from Metax
  function getLinksAsHtmlFromEtsinMetadata(rawEtsinMetadata) {
    if (rawEtsinMetadata != null) {
      let etsinLinks =
        '<br>' + translator.getVal('info.metadatalinksheader') + '<ul>'
      $.each(
        rawEtsinMetadata.research_dataset.remote_resources,
        (key, data) => {
          if (data.title != null) {
            if (
              data.download_url.identifier
                .toLowerCase()
                .indexOf('latauspalvelu') === -1
            ) {
              etsinLinks =
                etsinLinks +
                '<li><a href="' +
                data.download_url.identifier +
                '" target="_blank">' +
                data.title +
                '</a></li>'
            }
          }
        }
      )
      etsinLinks = etsinLinks + '</ul>'
      if (etsinLinks.indexOf('href') > 0) {
        return etsinLinks
      }
    }

    return null
  }

  // Get dataset's metadata description from Metax
  function getNotesAsHtmlFromEtsinMetadata(rawEtsinMetadata) {
    if (rawEtsinMetadata != null) {
      let notes = rawEtsinMetadata.research_dataset.description
      if (currentLocale == FINNISH_LANGUAGE) {
        notes = notes.fi
      } else if (currentLocale == ENGLISH_LANGUAGE) {
        notes = notes.en
      }

      if (notes == null) {
        return null
      }
      // Fix links from MarkDown to HTML
      const regexp = /\[.*?\]\(http.*?\)/g
      const matches = []
      let match

      while ((match = regexp.exec(notes)) != null) {
        matches.push(match.index)
      }

      matches.reverse()
      $.each(matches, (loopIdx, matchIdx) => {
        notes = notes.insert(
          matchIdx + 1,
          '<a href="' +
            notes.substring(
              notes.indexOf('(', matchIdx) + 1,
              notes.indexOf(')', matchIdx)
            ) +
            '" target="_blank">'
        )
        notes = notes.insert(notes.indexOf(']', matchIdx), '</a>')
        notes = notes.replace(
          notes.substring(
            notes.indexOf('(', matchIdx),
            notes.indexOf(')', matchIdx) + 1
          ),
          ''
        )
      })
      notes = notes.replace(/\[|\]/g, '')

      // Fix new lines from MarkDown to HTML
      return notes.replace(/(\r\n|\n|\r)/gm, '<br>')
    }
    return null
  }

  function cutLicenseURL(urn) {
    if (urn != null) {
      const arr = urn.split('geodata/')
      urn = arr[1]
    }
    return urn
  }

  function flipURN(urn) {
    const colon = ':'
    const dash = '-'
    if (urn.indexOf(colon) == -1) {
      const arr = urn.split(dash)
      urn =
        arr[0] +
        colon +
        arr[1] +
        colon +
        arr[2] +
        colon +
        arr[3] +
        dash +
        arr[4]
    }
    return urn
  }

  function fetchMetadataDescription(
    metadataURN,
    metadataNotes,
    successFn,
    errorFn
  ) {
    $.ajax({
      url: ETSIN_METADATA_JSON_BASE_URL + flipURN(metadataURN),
      success: (data) => successFn(data, metadataNotes),
      error: () => errorFn(metadataNotes),
    })
  }

  function setFeatureInfoTabDefaultContent() {
    const featureInfoDefaultLabel = $('<div>', {
      id: 'feature-info-default-label',
    })
    featureInfoDefaultLabel.append(translator.getVal('info.featureinfodefault'))
    featureInfoTabContentRoot.append(featureInfoDefaultLabel)
  }

  let isFirstTimeLoaded = true
  let mapsheets = 0

  function updateMap() {
    map.removeLayer(currentIndexMapLayer)
    map.removeLayer(currentIndexMapLabelLayer)
    map.removeLayer(currentDataLayer)
    locationSearchInput.val('')
    clearMapFeatureSelection()
    clearInfoBoxTabs()
    clearSearchResults()
    $('#feature-search-field').value = ''
    if (currentDataId != null) {
      setInfoContent('metadata')
      setFeatureInfoTabDefaultContent()
      loadIndexLayer()
      loadIndexMapLabelLayer()

      if (currentIndexMapLayer !== null) {
        currentIndexMapLayer.getSource().once('change', (event) => {
          let hasInfoTab = false
          if (event.target.getState() == 'ready' && isFirstTimeLoaded) {
            hasInfoTab = layerHasFeatureInfo()
            mapsheets = getCurrentLayerData('map_sheets')
            if (mapsheets > 1) {
              featureSearchContainer.css('visibility', 'visible')
            } else if (mapsheets === 1) {
              // if there is only one mapsheet, select all files
              selectedFeatures.extend(
                currentIndexMapLayer.getSource().getFeatures()
              )
              featureSearchContainer.css('visibility', 'hidden')
            }
            setInfoContent('download')
            isFirstTimeLoaded = false
            toggleMapControlButtonsVisibility()
          }
          selectTabAfterDatasetChange(hasInfoTab)
        })

        if (currentIndexMapLabelLayer !== null) {
          currentIndexMapLayer.on('change:visible', () => {
            if (currentIndexMapLayer.getVisible()) {
              currentIndexMapLabelLayer.setVisible(true)
            } else {
              currentIndexMapLabelLayer.setVisible(false)
            }
          })
        }

        const maxScaleResult = getCurrentLayerData('data_max_scale')
        if (maxScaleResult !== null) {
          currentMaxResolution = getMapResolutionFromScale(
            parseInt(maxScaleResult)
          )
        } else {
          currentMaxResolution = null
        }

        loadDataLayer()
        if (currentDataLayer !== null) {
          map.getLayers().insertAt(1, currentDataLayer)
          clearMapWarning()
        } else {
          setDataAvailabiltyWarning()
        }
        map.addLayer(currentIndexMapLayer)
        if (currentIndexMapLabelLayer !== null) {
          map.addLayer(currentIndexMapLabelLayer)
        }
        // Kylli, without next 3 rows, the warning of previously
        // selected dataset was visible.
        if (currentMaxResolution != null) {
          setMaxResolutionWarning()
        }
      }
      tabContainer.show()
    } else {
      mapsheets = 0
      tabContainer.hide()
    }
  }

  function layerHasFeatureInfo() {
    return getCurrentLayerData('data_url') !== null
  }

  //Show map related tools
  function toggleMapControlButtonsVisibility() {
    // If more than 1 mapsheet, show mapsheet selection tools
    if (mapsheets > 1) {
      selectSelectContainer.show()
      clearSelectContainer.show()
      drawSelectContainer.show()
    } else {
      selectSelectContainer.hide()
      clearSelectContainer.hide()
      drawSelectContainer.hide()
    }
    // If layers has feature info, show info tool and container for results
    if (layerHasFeatureInfo()) {
      infoSelectContainer.show()
      $('#feature-info-container-tab').show()
    } else {
      if (infoSelectBtn.hasClass('active')) {
        panSelectBtn.click()
      }
      infoSelectContainer.hide()
      $('#feature-info-container-tab').hide()
    }
  }

  function getCurrentLayerData(field) {
    const value = alasql(
      'SELECT ' + field + " FROM ? WHERE data_id='" + currentDataId + "'",
      [metadata]
    ).map((item) => item[field])
    if (
      typeof value !== 'undefined' &&
      value !== null &&
      typeof value[0] !== 'undefined' &&
      value[0] !== null
    ) {
      return value[0]
    } else {
      return null
    }
  }

  function loadIndexMapLabelLayer() {
    if (currentDataId !== null) {
      const url = WMS_INDEX_MAP_LABEL_LAYER_URL.replace(
        '!value!',
        currentDataId
      )
      const src = new source.ImageWMS({
        url: url,
        params: { VERSION: '1.1.1' },
        serverType: 'geoserver',
      })

      currentIndexMapLabelLayer = new layer.Image({
        source: src,
        visible: true,
      })
    } else {
      currentIndexMapLabelLayer = null
    }
  }

  function loadIndexLayer() {
    if (currentDataId !== null) {
      const url = WFS_INDEX_MAP_LAYER_URL.replace('!key!', 'data_id').replace(
        '!value!',
        currentDataId
      )
      const indexSource = new source.Vector({
        format: new format.GeoJSON(),
        loader: () => {
          $.ajax({
            jsonpCallback: 'loadIndexMapFeatures',
            dataType: 'jsonp',
            url:
              url +
              '&outputFormat=text/javascript&format_options=callback:loadIndexMapFeatures',
            success: (response) => {
              const features = indexSource.getFormat().readFeatures(response)
              indexSource.addFeatures(features)
            },
          })
        },
      })

      currentIndexMapLayer = new layer.Vector({
        title: translator.getVal('map.indexmap'),
        source: indexSource,
        visible: true,
        style: new style.Style({
          stroke: new style.Stroke({
            color: 'rgba(0, 0, 255, 1.0)',
            width: 2,
          }),
        }),
      })
    } else {
      currentIndexMapLayer = null
    }
    isFirstTimeLoaded = true
  }

  function loadDataLayer() {
    if (currentDataId !== null && currentDataUrl !== null) {
      if (currentDataUrl.indexOf('protected') > -1) {
        currentDataLayerSrc = new source.ImageWMS({
          url: WMS_PAITULI_BASE_URL,
          params: { LAYERS: currentDataUrl, VERSION: '1.1.1' },
          serverType: 'geoserver',
        })

        currentDataLayer = new layer.Image({
          title: translator.getVal('map.datamap'),
          source: currentDataLayerSrc,
          visible: true,
        })
      } else {
        currentDataLayerSrc = new source.TileWMS({
          url: WMS_PAITULI_BASE_URL_GWC,
          params: { LAYERS: currentDataUrl, VERSION: '1.1.1' },
          serverType: 'geoserver',
        })

        currentDataLayer = new layer.Tile({
          title: translator.getVal('map.datamap'),
          source: currentDataLayerSrc,
          visible: true,
        })
      }

      if (currentMaxResolution !== null) {
        currentDataLayer.setMaxResolution(currentMaxResolution)
      }
    } else {
      currentDataLayer = null
    }
  }

  function getMapResolutionFromScale(scale) {
    return scale / 2835
  }

  function getSearchResultFeatures(searchStr) {
    const hits = []
    currentIndexMapLayer.getSource().forEachFeature((feature) => {
      if (
        feature.get('label').toLowerCase().indexOf(searchStr.toLowerCase()) !=
        -1
      ) {
        hits.push(feature)
      }
    })
    return hits
  }

  const osmLayerOptions = {
    title: translator.getVal('map.basemap'),
    source: new source.TileWMS({
      url: 'http://ows.terrestris.de/osm/service?',
      attributions:
        'Background map: © <a target="_blank" href="http://ows.terrestris.de/dienste.html">terrestris</a>. Data: © <a target="_blank" href="http://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      params: {
        LAYERS: 'OSM-WMS',
        VERSION: '1.1.0',
      },
    }),
    opacity: 1.0,
    visible: true,
  }

  const municipalitiesLayer = new layer.Tile({
    title: translator.getVal('map.municipalitiesmap'),
    source: new source.TileWMS({
      url: WMS_PAITULI_BASE_URL,
      params: {
        LAYERS: LAYER_NAME_MUNICIPALITIES,
        SRS: 'EPSG:3067',
        VERSION: '1.1.0',
      },
    }),
    opacity: 1.0,
    visible: false,
  })

  const catchmentLayer = new layer.Tile({
    title: translator.getVal('map.catchment'),
    source: new source.TileWMS({
      url: WMS_PAITULI_BASE_URL,
      params: {
        LAYERS: LAYER_NAME_CATCHMENT_AREAS,
        SRS: 'EPSG:2393',
        VERSION: '1.1.0',
      },
    }),
    opacity: 1.0,
    visible: false,
  })

  const overviewMap = new control.OverviewMap({
    collapsed: false,
    layers: [new layer.Tile(osmLayerOptions)],
  })

  const map = new Map({
    layers: [
      new layer.Tile(osmLayerOptions),
      catchmentLayer,
      municipalitiesLayer,
    ],
    target: mapContainerId,
    view: new View({
      center: proj.transform([500000, 7200000], 'EPSG:3067', 'EPSG:3857'),
      zoom: 5,
    }),
  })

  const view = map.getView()

  map.on('moveend', () => setMaxResolutionWarning())

  function setMaxResolutionWarning() {
    if (currentMaxResolution !== null) {
      const currRes = view.getResolution()
      if (currRes > currentMaxResolution) {
        createMaxResolutionWarning()
      } else {
        clearMapWarning()
      }
    }
  }

  function setDataAvailabiltyWarning() {
    $('#notification-container').text(
      translator.getVal('map.dataAvailabilityWarning')
    )
    $('#notification-container').show()
  }

  function createMaxResolutionWarning() {
    $('#notification-container').text(
      translator.getVal('map.resolutionwarning')
    )
    $('#notification-container').show()
  }

  function clearMapWarning() {
    $('#notification-container').empty()
    $('#notification-container').hide()
  }

  function resetMapView() {
    view.setZoom(5)
    view.setCenter(proj.transform([500000, 7200000], 'EPSG:3067', 'EPSG:3857'))
    return false
  }

  // a normal select interaction to handle click
  const featureSelectInteraction = new interaction.Select({
    toggleCondition: condition.always,
    style: selected_style,
    multi: true, //Select several, if overlapping
  })

  featureSelectInteraction.on('select', () => setInfoContent('download'))

  const selectedFeatures = featureSelectInteraction.getFeatures()

  selectedFeatures.on('add', (event) => {
    fileLabelList.push(event.element.get('label'))
  })

  selectedFeatures.on('remove', (event) => {
    const deleteIdx = fileLabelList.indexOf(event.element.get('label'))
    if (deleteIdx > -1) {
      fileLabelList.splice(deleteIdx, 1)
    }
  })

  function clearMapFeatureSelection() {
    selectedFeatures.clear()
    setInfoContent('download')

    return false
  }

  function getTotalDownloadSize() {
    const fileSize = getCurrentLayerData('file_size')
    return fileSize !== null
      ? Math.ceil(fileSize * selectedFeatures.getLength())
      : 0
  }

  map.addInteraction(featureSelectInteraction)

  // a DragBox interaction used to select features by drawing boxes
  const mapDragBox = new interaction.DragBox({})

  mapDragBox.on('boxend', () => {
    const extent = mapDragBox.getGeometry().getExtent()

    // Check which mapsheets were selected before and which are new
    const newFeatures = []
    const oldFeaturesInSelection = []
    let existing

    currentIndexMapLayer
      .getSource()
      .forEachFeatureIntersectingExtent(extent, (feature) => {
        existing = selectedFeatures.remove(feature)
        if (existing) {
          oldFeaturesInSelection.push(feature)
        } else {
          newFeatures.push(feature)
        }
      })
    if (newFeatures.length > 0) {
      selectedFeatures.extend(oldFeaturesInSelection)
      selectedFeatures.extend(newFeatures)
    }
    setInfoContent('download')
  })
  map.addInteraction(mapDragBox)

  /* Add drawing vector source */
  const drawingSource = new source.Vector({
    useSpatialIndex: false,
  })

  /* Add drawing layer */
  const drawingLayer = new layer.Vector({
    source: drawingSource,
  })
  map.addLayer(drawingLayer)

  /*
   * Declare interactions and listener globally so we can attach listeners to
   * them later.
   */
  let draw

  // Drawing interaction
  draw = new interaction.Draw({
    source: drawingSource,
    type: 'Polygon',
    style: selected_style,
  })
  map.addInteraction(draw)

  function updateDrawSelection(event) {
    const polygon = event.feature.getGeometry()
    const features = currentIndexMapLayer.getSource().getFeatures()

    const newFeatures = []
    const oldFeaturesInSelection = []
    let existing

    for (let i = 0; i < features.length; i++) {
      if (polygon.intersectsExtent(features[i].getGeometry().getExtent())) {
        existing = selectedFeatures.remove(features[i])
        if (existing) {
          oldFeaturesInSelection.push(features[i])
        } else {
          newFeatures.push(features[i])
        }
      }
    }

    if (newFeatures.length > 0) {
      selectedFeatures.extend(oldFeaturesInSelection)
      selectedFeatures.extend(newFeatures)
    }
    setInfoContent('download')
    //Remove the drawed polygon from map. The drawend is fired before the polygon is added to the source,
    //so the first simply sets the geometry to null, and after next polygon is drawn it is properly removed.
    //Possibly there is one-liner for this.
    event.feature.setGeometry(null)
    drawingSource.clear()
  }

  draw.on('drawend', (event) => updateDrawSelection(event))

  const highlightCollection = new Collection()
  const highlightOverlay = new layer.Vector({
    map: map,
    source: new source.Vector({
      features: highlightCollection,
      useSpatialIndex: false, // optional, might improve performance
    }),
    style: highlighted_style,
    updateWhileAnimating: true, // optional, for instant visual feedback
    updateWhileInteracting: true, // optional, for instant visual feedback
  })

  function getFeatureInfo(evt) {
    setInfoContent('featureinfo', evt)
  }

  // TODO ???
  let getFeatureInfoToolKey = null

  // Select right tool
  // Set default
  let dragPan
  map.getInteractions().forEach((i) => {
    if (i instanceof interaction.DragPan) {
      dragPan = i
    }
  }, this)

  // Set interactions based on selection
  function selectPanTool() {
    $('#panselection-button').addClass('active')
    $('#selectselection-button').removeClass('active')
    $('#infoselection-button').removeClass('active')
    $('#drawselection-button').removeClass('active')

    selectedTool = 'drag'
    dragPan.setActive(true)
    featureSelectInteraction.setActive(false)
    mapDragBox.setActive(false)
    draw.setActive(false)
    unByKey(getFeatureInfoToolKey)
  }

  function selectSelectTool() {
    selectTab(0)
    $('#panselection-button').removeClass('active')
    $('#selectselection-button').addClass('active')
    $('#infoselection-button').removeClass('active')
    $('#drawselection-button').removeClass('active')

    selectedTool = 'select'
    dragPan.setActive(false)
    featureSelectInteraction.setActive(true)
    mapDragBox.setActive(true)
    draw.setActive(false)
    unByKey(getFeatureInfoToolKey)
  }

  function selectInfoTool() {
    selectTab(1)
    $('#panselection-button').removeClass('active')
    $('#selectselection-button').removeClass('active')
    $('#infoselection-button').addClass('active')
    $('#drawselection-button').removeClass('active')

    selectedTool = 'info'
    featureSelectInteraction.setActive(false)
    mapDragBox.setActive(false)
    draw.setActive(false)
    if (selectedTool != 'drag') {
      dragPan.setActive(true)
    }
    getFeatureInfoToolKey = map.on('singleclick', (event) =>
      getFeatureInfo(event)
    )
  }

  function selectDrawTool() {
    selectTab(0)
    $('#panselection-button').removeClass('active')
    $('#selectselection-button').removeClass('active')
    $('#infoselection-button').removeClass('active')
    $('#drawselection-button').addClass('active')

    selectedTool = 'draw'
    dragPan.setActive(true)
    featureSelectInteraction.setActive(false)
    mapDragBox.setActive(false)
    mapDragBox.setActive(false)
    draw.setActive(true)
    unByKey(getFeatureInfoToolKey)
  }

  const layerSwitcher = new LayerSwitcher({
    tipLabel: 'Toggle layers', // Optional label for button
  })

  const scaleLineControl = new control.ScaleLine()

  function initLocationSearch() {
    locationSearchInput.keypress((event) => {
      const keyCode = event.keyCode || event.charCode
      if (keyCode == 13) {
        const searchStr = locationSearchInput.val()
        if (searchStr.length > 0) {
          const queryUrl = NOMINATIM_API_URL.replace('!query!', searchStr)
          $.getJSON(queryUrl, (data) => {
            if (data.length > 0) {
              map
                .getView()
                .setCenter(
                  proj.transform(
                    [Number(data[0].lon), Number(data[0].lat)],
                    'EPSG:4326',
                    'EPSG:3857'
                  )
                )
              if (searchStr.indexOf(',') != -1) {
                map.getView().setZoom(16)
              } else {
                map.getView().setZoom(13)
              }
            } else {
              alert(translator.getVal('map.locationNotFound'))
            }
          })
        }
      }
    })
  }

  $('#resetview-button').on('click', resetMapView)
  $('#panselection-button').on('click', selectPanTool)
  $('#selectselection-button').on('click', selectSelectTool)
  $('#clearselection-button').on('click', clearMapFeatureSelection)
  $('#infoselection-button').on('click', selectInfoTool)
  $('#drawselection-button').on('click', selectDrawTool)

  selectPanTool()

  map.addControl(overviewMap)
  map.addControl(layerSwitcher)
  map.addControl(scaleLineControl)

  initFormInputs('form-input-container')
  initLocationSearch()
  resetMapView()
}

// checkAccessRights();
checkParameterDatasetAccess()
