function generateFingerprint() {
    const fingerprint = []

    // screen stuff
    fingerprint.push(window.screen.height)
    fingerprint.push(window.screen.width)
    fingerprint.push(window.screen.availHeight)
    fingerprint.push(window.screen.availWidth)

    // storage stuff
    if (window.navigator.cookieEnabled) {
        fingerprint.push(window.navigator.cookieEnabled)
    } else {
        document.cookie = 'fp'
        fingerprint.push(document.cookie.indexOf('fp') != -1)
    }

    if (window.localStorage) {
        for (let i = 0; i < window.localStorage.length; i++) {
            fingerprint.push(window.localStorage.key(i))
            fingerprint.push(window.localStorage.getItem(window.localStorage.key(i)))
        }
    }

    if (window.sessionStorage) {
        for (let i = 0; i < window.sessionStorage.length; i++) {
            fingerprint.push(window.sessionStorage.key(i))
            fingerprint.push(window.sessionStorage.getItem(window.sessionStorage.key(i)))
        }
    }

    // date time stuff
    const date = new Date()
    date.setTime(0)
    fingerprint.push(date.toLocaleString())

    // language stuff
    fingerprint.push(window.navigator.language)
    fingerprint.push(window.navigator.languages)

    // hardware stuff
    fingerprint.push(window.navigator.hardwareConcurrency)  // not IE, Safari 10.1-11, iOS Safari 10.3-11
    fingerprint.push(window.navigator.deviceMemory)         // not Firefox, IE, Safari
    fingerprint.push(window.navigator.userAgent)

    // plugin stuff
    if (window.navigator.plugins) {                         // deprecated, may not be able to enumerate
        for (let i = 0; i < window.navigator.plugins.length; i++) {
            const plugin = window.navigator.plugins[i]
            const mimetype = plugin[0]

            if (plugin) {
                fingerprint.push([i + ': ' + plugin.name, plugin.filename, plugin.description, mimetype.type, mimetype.suffixes].join(', '))
            }
        }
    }

    // canvas stuff
    const glCanvas = document.createElement("canvas")
    const gl = glCanvas.getContext("webgl") || glCanvas.getContext("experimental-webgl")

    fingerprint.push(gl.getParameter(gl.VERSION))
    fingerprint.push(gl.getParameter(gl.SHADING_LANGUAGE_VERSION))
    fingerprint.push(gl.getParameter(gl.VENDOR))
    fingerprint.push(gl.getParameter(gl.RENDERER))
    fingerprint.push(gl.getSupportedExtensions().join())

    // https://www.browserleaks.com/canvas#how-does-it-work
    const canvas2D = document.createElement("canvas")
    const ctx = canvas2D.getContext("2d")
    const txt = "https://github.com/atoponce/passgen3"

    ctx.textBaseline = "top"
    ctx.font = "14px 'Arial'"
    ctx.textBaseline = "alphabetic"
    ctx.fillStyle = "#f60"
    ctx.fillRect(125,1,62,20)
    ctx.fillStyle = "#069"
    ctx.fillText(txt, 2, 15)
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)"
    ctx.fillText(txt, 4, 17)
    fingerprint.push(canvas2D.toDataURL())

    return fingerprint.join()
}