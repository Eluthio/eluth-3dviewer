import ModelViewer from './ModelViewer.vue'

window.__EluthPlugins = window.__EluthPlugins || {}
window.__EluthPlugins['model-viewer'] = {
    component: ModelViewer,
    zones: ['input'],
    messageRenderer: {
        pattern: /\/storage\/uploads\/models\/[^\s"<]+\.(obj|stl|glb|gltf)/i,
        render(url) {
            const cleanUrl  = url.split('?')[0]
            const filename  = cleanUrl.split('/').pop()
            const baseUrl   = cleanUrl.replace(/\/storage\/uploads\/.+$/, '')
            const viewerUrl = baseUrl + '/storage/plugins/model-viewer/viewer.html?url=' + encodeURIComponent(cleanUrl)
            const allowDl   = url.includes('dl=1')

            let html = '<span style="display:block;margin:4px 0">'
            html += '<iframe src="' + viewerUrl + '" style="width:100%;max-width:480px;height:300px;border:none;border-radius:8px;display:block" allowfullscreen loading="lazy"></iframe>'
            if (allowDl) {
                html += '<span style="display:inline-flex;align-items:center;gap:6px;margin-top:4px;font-size:12px;color:rgba(255,255,255,.5)">'
                html += '<span>📦</span><span>' + filename + '</span>'
                html += '<a href="' + cleanUrl + '" download="' + filename + '" style="color:#a78bfa;text-decoration:none" title="Download">↓ Download</a>'
                html += '</span>'
            }
            html += '</span>'
            return html
        }
    },
}
