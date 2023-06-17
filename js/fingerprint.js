"use strict"

/**
 * Basic generation of a unique browser fingerprint for premuting Spritz.
 * The goal is to be unique enough from other users. While there are better
 * fingerprinting tools out there, this should be "good enough" for password
 * generation. However, I'm open to improvements without getting too complex.
 * @returns {string} - A long text string of the data discovered.
 */
function generateFingerprint() {
  let len
  let tmp // for random storage things
  const fingerprint = []

  /**
   * Some other functions that might be worth investigating from Fingerprint2.js:
   * 
   * - addBehaviorKey()
   * - webglKey()
   * - hasLiedLanguagesKey()
   * - hasLiedResolutionKey()
   * - hasLiedOsKey()
   * - hasLiedBrowserKey()
   * - touchSupportKey()
   */

  // User agent
  fingerprint.push(window.navigator.userAgent)

  // Screen
  fingerprint.push((window.screen.width > window.screen.height) ? [window.screen.width, window.screen.height] : [window.screen.height, window.screen.width])
  fingerprint.push((window.screen.availWidth > window.screen.availHeight) ? [window.screen.availWidth, window.screen.availHeight] : [window.screen.availHeight, window.screen.availWidth])

  // Color depth
  fingerprint.push(window.screen.colorDepth)

  // Plugins
  tmp = []
  len = window.navigator.plugins.length
  for (let i = 0; i < len; i++) {
    tmp.push(window.navigator.plugins[i].name)
  }
  tmp = tmp.sort(function(a, b) {
    return a[0] - b[0]
  })
  tmp.sort()

  // Cookies
  if (window.navigator.cookieEnabled) {
    fingerprint.push(window.navigator.cookieEnabled)
  } else {
    document.cookie = "fp"
    fingerprint.push(document.cookie.indexOf("fp") != -1)
  }

  // localStorage
  try {!!window.localStorage} catch(e) {return true}

  // sessionStorage
  try {!!window.sessionStorage} catch(e) {return true}

  // indexedDB
  fingerprint.push(!!window.indexedDB)

  // openDatabase
  fingerprint.push(!!window.openDatabase)

  // CPU class
  fingerprint.push(!!window.navigator.cpuClass ? window.navigator.cpuClass : "unknown")

  // Platform
  fingerprint.push(!!window.navigator.platform ? window.navigator.platform : "unknown")

  // Do Not Track
  fingerprint.push(!!window.navigator.doNotTrack ? window.navigator.doNotTrack : "unknown")

  // Time zone
  fingerprint.push(new Date().getTimezoneOffset())

  // Language
  fingerprint.push(window.navigator.language)

  // Mime types
  len = window.navigator.mimeTypes.length
  for (let i = 0; i < len; i++) {
    fingerprint.push(window.navigator.mimeTypes[i].description)
  }

  // Canvas
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  const txt = "https://github.com/atoponce/passgen3"

  ctx.textBaseline = "top"
  ctx.font = "14px 'Arial'"
  ctx.textBaseline = "alphabetic"
  ctx.fillStyle = "#f60"
  ctx.fillRect(125, 1, 62, 20)
  ctx.fillStyle = "#069"
  ctx.fillText(txt, 2, 15)
  ctx.fillStyle = "rgba(102, 204, 0, 0.7)"
  ctx.fillText(txt, 4, 17)

  fingerprint.push(canvas.toDataURL())

  // Adblocking
  const ads = document.createElement("div")
  ads.setAttribute("id", "ads")
  document.body.appendChild(ads)
  fingerprint.push(document.getElementById("ads") ? false : true)

  return fingerprint.join("|")
}