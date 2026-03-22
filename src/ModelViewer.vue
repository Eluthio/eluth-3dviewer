<template>
    <div class="model-wrap" ref="wrapRef">
        <!-- Upload button — hidden while a model is pending confirmation -->
        <button
            v-if="!pendingUpload"
            class="model-btn"
            :class="{ active: uploading }"
            @click="triggerPicker"
            :disabled="uploading"
            title="Upload 3D model (OBJ / STL / GLB)"
        >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
        </button>

        <input
            ref="fileInput"
            type="file"
            accept=".obj,.stl,.glb,.gltf"
            style="display:none"
            @change="onFileChosen"
        />

        <!-- Upload progress -->
        <div v-if="uploading" class="model-uploading">
            <div class="model-progress-bar" :style="{ width: progress + '%' }"></div>
        </div>

        <!-- Post-upload confirmation panel -->
        <Teleport to="body">
            <div v-if="pendingUpload" class="model-confirm-panel" :style="confirmStyle">
                <div class="model-confirm-header">
                    <span class="model-confirm-icon">📦</span>
                    <span class="model-confirm-name" :title="pendingUpload.filename">{{ pendingUpload.filename }}</span>
                </div>
                <label class="model-confirm-dl">
                    <input type="checkbox" v-model="allowDownload" />
                    Allow others to download
                </label>
                <div class="model-confirm-actions">
                    <button class="model-confirm-post" @click="postToChat">Post to chat</button>
                    <button class="model-confirm-cancel" @click="cancelUpload">Cancel</button>
                </div>
            </div>
        </Teleport>

        <div v-if="error" class="model-error">{{ error }}</div>
    </div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'

const props = defineProps({
    settings:  { type: Object, default: () => ({}) },
    authToken: { type: String, default: '' },
    apiBase:   { type: String, default: '' },
})
const emit = defineEmits(['insert'])

const wrapRef      = ref(null)
const fileInput    = ref(null)
const uploading    = ref(false)
const progress     = ref(0)
const error        = ref('')
const pendingUpload = ref(null)   // { url, filename } after upload, before post
const allowDownload = ref(true)
const confirmStyle  = ref({})

let errorTimer = null

function showError(msg) {
    error.value = msg
    clearTimeout(errorTimer)
    errorTimer = setTimeout(() => { error.value = '' }, 4000)
}

function triggerPicker() {
    fileInput.value?.click()
}

function positionConfirmPanel() {
    const rect = wrapRef.value?.getBoundingClientRect()
    if (!rect) return
    const panelWidth = 260
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8))
    confirmStyle.value = {
        left:   left + 'px',
        bottom: (window.innerHeight - rect.top + 8) + 'px',
    }
}

async function upload(file) {
    if (!file) return

    const allowed = ['obj', 'stl', 'glb', 'gltf']
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!allowed.includes(ext)) {
        showError('Supported formats: OBJ, STL, GLB, GLTF')
        return
    }

    const maxMb = parseInt(props.settings?.max_upload_mb) || 50
    if (file.size > maxMb * 1024 * 1024) {
        showError(`File must be under ${maxMb} MB.`)
        return
    }

    uploading.value = true
    progress.value  = 0
    error.value     = ''

    const formData = new FormData()
    formData.append('model', file)

    try {
        const xhr = new XMLHttpRequest()
        const data = await new Promise((resolve, reject) => {
            xhr.upload.addEventListener('progress', e => {
                if (e.lengthComputable) progress.value = Math.round((e.loaded / e.total) * 90)
            })
            xhr.addEventListener('load', () => {
                progress.value = 100
                if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText))
                else reject(new Error(JSON.parse(xhr.responseText)?.message || 'Upload failed.'))
            })
            xhr.addEventListener('error', () => reject(new Error('Network error.')))
            xhr.open('POST', props.apiBase.replace(/\/$/, '') + '/api/plugins/model-viewer/upload')
            xhr.setRequestHeader('Authorization', 'Bearer ' + props.authToken)
            xhr.send(formData)
        })

        // Show confirmation panel instead of posting immediately
        allowDownload.value = true
        pendingUpload.value = { url: data.url, filename: file.name }
        positionConfirmPanel()
    } catch (err) {
        showError(err.message || 'Upload failed.')
    } finally {
        uploading.value = false
        progress.value  = 0
        if (fileInput.value) fileInput.value.value = ''
    }
}

function postToChat() {
    if (!pendingUpload.value) return
    const url = allowDownload.value
        ? pendingUpload.value.url + '?dl=1'
        : pendingUpload.value.url
    emit('insert', url)
    pendingUpload.value = null
}

function cancelUpload() {
    pendingUpload.value = null
}

function onFileChosen(e) {
    const file = e.target.files[0]
    if (file) upload(file)
}

onUnmounted(() => clearTimeout(errorTimer))
</script>

<style scoped>
.model-wrap { position: relative; display: inline-flex; align-items: center; }

.model-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    color: rgba(255,255,255,.45);
    transition: color .15s, background .15s;
    display: flex;
    align-items: center;
}
.model-btn:hover, .model-btn.active { color: #a78bfa; background: rgba(167,139,250,.1); }
.model-btn:disabled { opacity: .5; cursor: default; }

.model-uploading {
    position: absolute;
    bottom: -3px;
    left: 0;
    right: 0;
    height: 2px;
    background: rgba(255,255,255,.1);
    border-radius: 2px;
    overflow: hidden;
}
.model-progress-bar { height: 100%; background: #a78bfa; transition: width .2s; }

.model-confirm-panel {
    position: fixed;
    width: 260px;
    background: var(--bg-secondary, #2b2d31);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,.5);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 9999;
}

.model-confirm-header {
    display: flex;
    align-items: center;
    gap: 8px;
}
.model-confirm-icon { font-size: 20px; flex-shrink: 0; }
.model-confirm-name {
    font-size: 13px;
    color: rgba(255,255,255,.85);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.model-confirm-dl {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    color: rgba(255,255,255,.6);
    cursor: pointer;
    user-select: none;
}
.model-confirm-dl input { cursor: pointer; }

.model-confirm-actions {
    display: flex;
    gap: 6px;
}

.model-confirm-post {
    flex: 1;
    background: rgba(167,139,250,.2);
    border: 1px solid rgba(167,139,250,.4);
    border-radius: 6px;
    color: #c4b5fd;
    font-size: 13px;
    font-weight: 600;
    padding: 6px 10px;
    cursor: pointer;
    transition: background .15s;
}
.model-confirm-post:hover { background: rgba(167,139,250,.35); }

.model-confirm-cancel {
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 6px;
    color: rgba(255,255,255,.4);
    font-size: 12px;
    padding: 6px 10px;
    cursor: pointer;
    transition: background .15s;
}
.model-confirm-cancel:hover { background: rgba(255,255,255,.1); color: rgba(255,255,255,.7); }

.model-error {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: #7f1d1d;
    color: #fca5a5;
    font-size: 12px;
    padding: 5px 10px;
    border-radius: 6px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 100;
}
</style>
