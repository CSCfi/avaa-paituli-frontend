import $ from 'jquery'

import { translate } from '../../shared/translations'
import globals from '../globals'
import datasets from '../datasets'
import emailModal from './emailModal'

const MAX_DOWNLOADABLE_SIZE = 3000
const TAB_ID = 'download-container'
const rootElem = $('#' + TAB_ID)

// files selected for download
let filePaths = []
let fileLabels = []

function init(highlightOverlay) {
  highlightOverlay.getSource().clear()

  // Download and download list buttons are inside wrappers so that
  // tooltips can be attached to wrappers instead of buttons. This way
  // tooltips retain constant style even when buttons are disabled.
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
  dlButton.text(translate('info.download') + ': ~' + getDownloadSize() + ' Mb')
  dlButton.appendTo(dlButtonWrapper)

  let dlListWrapper = $('#dl-list-wrapper')
  if (!dlListWrapper.length) {
    dlListWrapper = $('<a>', {
      id: 'dl-list-wrapper',
      title: translate('info.dlListTooltip'),
    })
  }
  let dlListButton = $('#download-list-button')
  if (!dlListButton.length) {
    dlListButton = $('<button>', {
      class: 'btn btn-default',
      id: 'download-list-button',
    })
  }
  dlListButton.text(translate('info.downloadlist'))
  dlListButton.appendTo(dlListWrapper)

  // Hide files list download option, if HAKA-dataset, these are not in FTP.
  const dataAccess = datasets.getCurrent().access
  if (dataAccess == 1) {
    dlListButton.css('visibility', 'visible')
  } else {
    dlListButton.css('visibility', 'hidden')
  }

  let licenseHeader = $('#download-license-header')
  if (!licenseHeader.length) {
    licenseHeader = $('<h5>', {
      id: 'download-license-header',
      class: 'download-tab-header',
    })
  }
  licenseHeader.text(translate('info.documents'))

  //http://www.nic.funet.fi/index/geodata/mml/NLS_terms_of_use.pdf -> crop after geodata/
  const licenseUrl = datasets.getCurrent().license_url
  const dlLicInputId = 'download-license-input'
  let dlLicContainer = $('#download-license-container')
  let dlLicInput = $('#' + dlLicInputId)
  let dlLicLabelLink = $('#download-license-link')
  if (!dlLicInput.length) {
    dlLicContainer = $('<div>', {
      id: 'download-license-container',
    })
    dlLicLabelLink = $('<a>', {
      id: 'download-license-link',
      href: licenseUrl,
      target: '_blank',
      class: 'download-license-link',
      'data-value': translate('info.license'),
    })
    dlLicLabelLink.text(translate('info.license'))
    dlLicInput = $('<input>', {
      checked: 'checked',
      id: dlLicInputId,
      type: 'checkbox',
      value: cutLicenseURL(licenseUrl),
      class: 'download-checkbox',
    })
    dlLicInput.appendTo(dlLicContainer)
    dlLicLabelLink.appendTo(dlLicContainer)
  }

  const downloadFilesHeader = $('<h5>', {
    id: 'download-file-header',
    class: 'download-tab-header',
  })
  downloadFilesHeader.text(translate('info.files'))

  const selectedFeatures = globals.getSelectedFeatures()
  if (selectedFeatures.getLength() > 0) {
    let dataListContainerElem = $('#data-download-list')
    if (!dataListContainerElem.length) {
      rootElem.empty()
      dlButtonWrapper.appendTo(rootElem)
      dlListWrapper.appendTo(rootElem)
      licenseHeader.appendTo(rootElem)

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
    fileLabels = []
    const dlLabelList = []

    selectedFeatures.forEach((feature) => {
      const label = feature.get('label')
      fileLabels.push(label)
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
          const olId = globals
            .getIndexLayer()
            .getSource()
            .getFeatureById($(event.target).attr('ol_id'))
          highlightOverlay.getSource().addFeature(olId)
          dlLabel.css('font-weight', 'bold')
        },
        (event) => {
          const olId = globals
            .getIndexLayer()
            .getSource()
            .getFeatureById($(event.target).attr('ol_id'))
          highlightOverlay.getSource().removeFeature(olId)
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
    rootElem.empty()
    dlButtonWrapper.appendTo(rootElem)
    dlListWrapper.appendTo(rootElem)
    licenseHeader.appendTo(rootElem)
    dlLicContainer.appendTo(rootElem)
    downloadFilesHeader.appendTo(rootElem)
    const downloadInfo = $('<div>', {
      id: 'download-info-container',
    })
    downloadInfo.text(translate('info.info'))
    downloadInfo.appendTo(rootElem)
  }
  dlLicInput.on('change', () => {
    updateDownloadFileList(dlButton, dlButtonWrapper, dlListButton, dlLicInput)
    updateFileLabelListForLicense(dlLicInput, licenseUrl)
  })
  dlButton.on('click', (event) => {
    event.preventDefault()
    event.stopImmediatePropagation()
    if (
      dlLicInput.prop('checked') ? filePaths.length > 1 : filePaths.length > 0
    ) {
      emailModal.openDataModal(filePaths, fileLabels, getDownloadSize())
    }
  })
  dlListButton.on('click', (event) => {
    event.preventDefault()
    event.stopImmediatePropagation()
    if (
      dlLicInput.prop('checked') ? filePaths.length > 1 : filePaths.length > 0
    ) {
      emailModal.openListModal(filePaths, fileLabels, getDownloadSize())
    }
  })
  updateDownloadFileList(dlButton, dlButtonWrapper, dlListButton, dlLicInput)
  updateFileLabelListForLicense(dlLicInput, licenseUrl)
}

function getDownloadSize() {
  const fileSize = datasets.getCurrent().file_size
  return fileSize !== null
    ? Math.ceil(fileSize * globals.getSelectedFeatures().getLength())
    : 0
}

function updateSelectedFeatures(clickedFeature, dlInput) {
  if (dlInput.is(':checked')) {
    globals.getSelectedFeatures().push(clickedFeature)
  } else {
    globals.getSelectedFeatures().remove(clickedFeature)
  }
}

function updateFileLabelListForLicense(dlLicInput, licenseUrl) {
  const licenseIdx = fileLabels.indexOf(licenseUrl)
  if (dlLicInput.prop('checked')) {
    if (licenseIdx == -1) {
      fileLabels.push(licenseUrl)
    }
  } else {
    if (licenseIdx > -1) {
      fileLabels.splice(licenseIdx, 1)
    }
  }
}

function updateDownloadFileList(
  dlButton,
  dlButtonWrapper,
  dlListButton,
  dlLicInput
) {
  filePaths = []
  const markedForDownload = $('.download-checkbox:checked')
  markedForDownload.each((i, checkbox) => filePaths.push(checkbox.value))

  updateDownloadButton(dlButton, dlButtonWrapper, dlLicInput)
  updateDownloadListButton(dlListButton, dlLicInput)
}

function updateDownloadButton(dlButton, dlButtonWrapper, dlLicInput) {
  dlButton.text(translate('info.download') + ': ~' + getDownloadSize() + ' Mb')
  if (
    (dlLicInput.prop('checked')
      ? filePaths.length > 1
      : filePaths.length > 0) &&
    getDownloadSize() <= MAX_DOWNLOADABLE_SIZE
  ) {
    dlButton.prop('disabled', false)
    dlButtonWrapper.removeAttr('title')
  } else {
    if (getDownloadSize() > MAX_DOWNLOADABLE_SIZE) {
      dlButtonWrapper.attr('title', translate('info.downloadTooltip'))
    }
    dlButton.prop('disabled', true)
  }
}

function updateDownloadListButton(dlListButton, dlLicInput) {
  if (
    dlLicInput.prop('checked') ? filePaths.length > 1 : filePaths.length > 0
  ) {
    dlListButton.prop('disabled', false)
  } else {
    dlListButton.prop('disabled', true)
  }
}

function cutLicenseURL(urn) {
  if (urn != null) {
    const arr = urn.split('geodata/')
    urn = arr[1]
  }
  return urn
}

function addFileLabel(event) {
  fileLabels.push(event.element.get('label'))
}

function removeFileLabel(event) {
  const deleteIdx = fileLabels.indexOf(event.element.get('label'))
  if (deleteIdx > -1) {
    fileLabels.splice(deleteIdx, 1)
  }
}

export default {
  TAB_ID,
  init,
  addFileLabel,
  removeFileLabel,
}