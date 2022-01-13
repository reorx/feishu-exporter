document.querySelector('#menu').addEventListener('click', function(e) {
  if (e.target.tagName === 'A') {
    var ext = e.target.dataset.ext;
    console.log('clicked ext', ext)
    sendItemClick(ext, () => {
      window.close()
    })
  }
});

const defaultTypeExts = {
  doc: 'docx',  // docs, pdf
  sheet: 'xlsx',  // xlsx, csv
  bitable: 'xlsx',  // xlsx, csv
}


const sendItemClick = (ext, callback) => {
  // send message to background.js
  const typeExts = Object.assign({}, defaultTypeExts)
  typeExts.doc = ext

  chrome.runtime.sendMessage({
    action: 'start',
    typeExts,
  }, res => {
    console.log('popup resp', res)
    callback()
  })
}
