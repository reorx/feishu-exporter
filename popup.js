document.querySelector('#menu').addEventListener('click', function(e) {
  if (e.target.tagName === 'A') {
    var ext = e.target.dataset.ext;
    console.log('clicked ext', ext)
    sendItemClick(ext)
    // window.close()
  }
});


const sendItemClick = (ext) => {
  // send message to background.js
  chrome.runtime.sendMessage({
    action: 'start',
    ext,
  }, res => {
    console.log('popup resp', res)
  })
}
