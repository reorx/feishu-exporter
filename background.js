console.log('bg start receiving')
// listen to message from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('bg receives message', request)
  if (request.action === 'start') {
    sendResponse('pong')

    // get current tab
    chrome.tabs.query({active: true, currentWindow: true})
    .then(tabs => {
      const tab = tabs[0];

      const sendExportMessage = () => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'export',
          typeExts: request.typeExts,
        }, res => {
          console.log('bg export res', res)
        })
      }

      console.log(`tab ${tab.id}: check if tab is injected by sending ping message`)
      chrome.tabs.sendMessage(tab.id, {
        action: 'ping',
      }, res => {
        // if not injected, the following error will raise:
        // Unchecked runtime.lastError: Could not establish connection. Receiving end does not exist.
        if (chrome.runtime.lastError) {
          console.log(`tab ${tab.id}: ping no response, start injection`)
          // fisrt inject script
          chrome.scripting.executeScript({
            target: {tabId: tab.id},
            files: ['inject.js']
          }, () => {
            // then send message to inject.js
            sendExportMessage()
          });
        } else {
          console.log(`tab ${tab.id}: ping responses ${res}, already injected`)
          sendExportMessage()
        }
      })
    })
  }
})
