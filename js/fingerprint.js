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
  const fingerprint = []

  // User agent
  fingerprint.push(window.navigator.userAgent)

  // Screen
  fingerprint.push(window.screen.availWidth + "×" + window.screen.availHeight)
  fingerprint.push(window.screen.width + "×" + window.screen.height)

  // Plugins
  len = window.navigator.plugins.length
  for (let i = 0; i < len; i++) {
    fingerprint.push(window.navigator.plugins[i].name)
  }

  // Cookies
  if (window.navigator.cookieEnabled) {
    fingerprint.push(window.navigator.cookieEnabled)
  } else {
    document.cookie = "fp"
    fingerprint.push(document.cookie.indexOf("fp") != -1)
  }

  // localStorage
  len = window.localStorage.length
  for (let i = 0; i < len; i++) {
    fingerprint.push(window.localStorage.key(i))
    fingerprint.push(window.localStorage.getItem(window.localStorage.key(i)))
  }

  // sessionStorage
  len = window.sessionStorage.length
  for (let i = 0; i < len; i++) {
    fingerprint.push(window.sessionStorage.key(i))
    fingerprint.push(
      window.sessionStorage.getItem(window.sessionStorage.key(i))
    )
  }

  // Time zone
  const date = new Date()
  const offset = date.getTimezoneOffset() / 60
  const name = date
    .toLocaleDateString(undefined, { day: "2-digit", timeZoneName: "long" })
    .substring(4)

  if (offset > 0) {
    fingerprint.push("GMT-" + ("0" + offset).slice(-2) + "/" + name)
  } else {
    fingerprint.push("GMT+" + ("0" + offset).slice(-2) + "/" + name)
  }

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

  return fingerprint.join("|")
}
