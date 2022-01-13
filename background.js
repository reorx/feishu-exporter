const injectedTabs = {}

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

      const sendMessage = () => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'export',
          typeExts: request.typeExts,
        }, res => {
          console.log('bg export res', res)
        })
      }

      console.log(`tab ${tab.id}: check injectedTabs`, injectedTabs)

      if (injectedTabs[tab.id]) {
        console.log(`tab ${tab.id}: already injected`)
        sendMessage()
      } else {
        console.log(`tab ${tab.id}: start injection`)
        injectedTabs[tab.id] = true
        // fisrt inject script
        chrome.scripting.executeScript({
          target: {tabId: tab.id},
          files: ['inject.js']
        }, () => {
          // then send message to inject.js
          sendMessage()
        });
      }
    })
  }
})
