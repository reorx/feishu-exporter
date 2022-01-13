(() => {
  console.log('injected from feishu-exporter')

  // prepare parameters
  const feishuDomain = location.origin

  // get `_csrf_token` from cookie
  var csrfToken
  document.cookie.split(';').forEach(c => {
    // strip space for c
    c = c.trim()
    if (c.startsWith('_csrf_token')) {
      csrfToken = c.split('=')[1]
      return
    }
  })
  console.log('csrfToken: ', csrfToken)
  if (!csrfToken) {
    throw new Error('no csrf token')
  }

  const exportDoc = (docId, name) => {
    console.log(`exporting doc: name=${name} id=${docId}`)
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
        token: docId,
        type: 'doc',
        file_extension: 'pdf',
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
      return ticket
    })
    .then(ticket => {
      return getFileToken(ticket)
    })
    .then(fileToken => {
      // download file
      // GET https://your-company.feishu.cn/space/api/box/stream/download/all/boxcnBTyV6fBAjusDWW8QHFO3Sd
      return downloadURIBlob(
        `${feishuDomain}/space/api/box/stream/download/all/${fileToken}`,
        `${name}.pdf`)
    })

    // recursively request for file_token until it returns
    function getFileToken(ticket, retryCount = 0) {
      console.log(`getFileToken, count=${retryCount++}`)
      // GET https://your-company.feishu.cn/space/api/export/result/7052560242755582533?token=do4cnx3yi4xV1CNX7CxLcuPcwBc&type=doc
      // response (not prepared):
      // {"code":0,"data":{"result":{"extra":null,"file_extension":"","file_name":"","file_size":0,"file_token":"","job_error_msg":"","job_status":2,"type":""}},"msg":"success"}
      // response (prepared)
      // {"code":0,"data":{"result":{"extra":null,"file_extension":"pdf","file_name":"测试文档","file_size":17729,"file_token":"boxcnBTyV6fBAjusDWW8QHFO3Sd","job_error_msg":"success","job_status":0,"type":"doc"}},"msg":"success"}
      return fetch(`${feishuDomain}/space/api/export/result/${ticket}?token=${docId}&type=doc`)
      .then(response => response.json())
      .then(json => {
        if (!json.data) {
          throw new Error('get file token failed: no data')
        }
        const result = json.data.result
        if (result.file_token) {
          return result.file_token
        } else {
          return sleep(1000).then(() => getFileToken(ticket, retryCount))
        }
      })
    }
  }

  if (location.pathname.startsWith('/docs/')) {
    console.log('in doc page')
    const docId = getDocIdFromPath(location.pathname)
    const name = document.querySelector('.note-title p').innerText
    exportDoc(docId, name)
  } else if (location.pathname.startsWith('/drive/')) {
    console.log('in drive page')
    document.querySelectorAll('.file-list-item.selected').forEach(item => {
      const a = item.querySelector('a')
      if (!a) {
        throw new Error('cannot parse selected item: a', item)
      }
      const span = item.querySelector('span[title]')
      if (!span) {
        throw new Error('cannot parse selected item: span', item)
      }

      exportDoc(getDocIdFromPath(a.href), span.innerText)
    })
  }

  /* utils */

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getDocIdFromPath(path) {
    const pathSp = path.split('/')
    return pathSp[pathSp.length - 1]
  }

  function downloadURI(uri, name = '') {
      var link = document.createElement("a");
      link.style.display = 'none';
      document.body.appendChild(link);
      link.setAttribute('download', name);
      link.href = uri;
      console.log(`start download: uri=${uri}, name=${name}`, link)
      link.click();
      link.remove();
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
