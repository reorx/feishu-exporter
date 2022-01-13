(() => {
  console.log('injected from feishu-exporter')

  // prepare parameters
  const feishuDomain = location.origin
  const csrfToken = getCookie('_csrf_token')
  if (!csrfToken) {
    throw new Error('no csrf token')
  }
  // console.log('csrfToken: ', csrfToken)
  const itemRegex = /^\/(docs|sheets)\/(.*)$/
  const parseItemPath = path => {
    const match = itemRegex.exec(path)
    if (!match) {
      return
    }
    const v = {
      id: match[2],
    }
    switch (match[1]) {
      case 'docs':
        v.type = 'doc'
        break
      case 'sheets':
        v.type = 'sheet'
        break
    }
    return v
  }

  // listen chrome message
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'export') {
      console.log('receive message', request)
      sendResponse('pong')
      const typeExts = request.typeExts

      const singleItemPath = parseItemPath(location.pathname)
      if (singleItemPath) {
        // single item page
        console.log('single item page', location.pathname)
        const name = document.querySelector('.note-title p').innerText
        new ItemExporter(singleItemPath.type, singleItemPath.id, name, typeExts).export()
      } else if (location.pathname.startsWith('/drive/')) {
        // multiple item page
        console.log('multiple item page')
        document.querySelectorAll('.file-list-item.selected').forEach(item => {
          const a = item.querySelector('a')
          if (!a) {
            throw new Error('cannot parse selected item: a', item)
          }
          const span = item.querySelector('span[title]')
          if (!span) {
            throw new Error('cannot parse selected item: span', item)
          }
          const path = a.getAttribute('href')

          itemPath = parseItemPath(path)
          if (!itemPath) {
            console.warn('cannot match selected item href: ', path)
            return
          }
          new ItemExporter(itemPath.type, itemPath.id, span.innerText, typeExts).export()
        })
      }
    }
  })

  class ItemExporter {
    constructor(type, id, name, typeExts) {
      this.type = type  // docs or sheets
      this.id = id
      this.name = name
      this.ext = typeExts[this.type]
      console.log(`ItemExporter init: name=${this.name} ext=${this.ext} type=${this.type} id=${this.id}`)
    }

    export() {
      // create export task
      // POST https://your-company.feishu.cn/space/api/export/create/
      // request: {"token":"do4cnx3yi4xV1CNX7CxLcuPcwBc","type":"doc","file_extension":"pdf","event_source":"1"}
      // response: {"code":0,"data":{"job_timeout":600,"ticket":"7052560242755582533"},"msg":"success"}
      const taskUrl = `${feishuDomain}/space/api/export/create/`
      // use fetch API to send post request to taskUrl
      fetch(taskUrl, {
        method: 'POST',
        headers: {
          'x-csrftoken': csrfToken,
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: this.id,
          type: this.type,
          file_extension: this.ext,
          event_source: '1'
        })
      })
      .then(response => response.json())
      .then(json => {
        console.log('create task response: ', json)
        if (!json.data) {
          throw new Error('create task failed: no data')
        }
        const ticket = json.data.ticket
        if (!ticket) {
          throw new Error('create task failed: no ticket')
        }

        return this.getFileToken(ticket)
      })
      .then(fileToken => {
        // download file
        // GET https://your-company.feishu.cn/space/api/box/stream/download/all/boxcnBTyV6fBAjusDWW8QHFO3Sd
        return downloadURIBlob(
          `${feishuDomain}/space/api/box/stream/download/all/${fileToken}`,
          `${this.name}.${this.ext}`)
      })
    }

    // recursively request for file_token until it returns
    getFileToken(ticket, retryCount = 0) {
      console.log(`getFileToken, count=${retryCount++}`)
      // GET https://your-company.feishu.cn/space/api/export/result/7052560242755582533?token=do4cnx3yi4xV1CNX7CxLcuPcwBc&type=doc
      // response (not prepared):
      // {"code":0,"data":{"result":{"extra":null,"file_extension":"","file_name":"","file_size":0,"file_token":"","job_error_msg":"","job_status":2,"type":""}},"msg":"success"}
      // response (prepared)
      // {"code":0,"data":{"result":{"extra":null,"file_extension":"pdf","file_name":"测试文档","file_size":17729,"file_token":"boxcnBTyV6fBAjusDWW8QHFO3Sd","job_error_msg":"success","job_status":0,"type":"doc"}},"msg":"success"}
      return fetch(`${feishuDomain}/space/api/export/result/${ticket}?token=${this.id}&type=${this.type}`)
      .then(response => response.json())
      .then(json => {
        if (!json.data) {
          throw new Error('get file token failed: no data')
        }
        const result = json.data.result
        if (result.file_token) {
          return result.file_token
        } else {
          return sleep(1000).then(() => this.getFileToken(ticket, retryCount))
        }
      })
    }
  }

  /* utils */

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getCookie(key) {
    var value
    document.cookie.split(';').forEach(c => {
      c = c.trim()
      const sp = c.split('=')
      if (sp.length === 2 && sp[0] === key) {
        value = sp[1]
        return
      }
    })
    return value
  }

  function downloadURIBlob(uri, name) {
    return fetch(uri)
    .then(resp => resp.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    })
  }
})()
