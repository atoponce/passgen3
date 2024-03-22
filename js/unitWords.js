"use strict"

/**
 * Generate vaild (and absurd!) systems of units for the metric system, units
 * of information, and orders of magnitude using prefixes and suffixes with
 * their base units. The goal isn't to be realistic, but rather have something
 * to type when collecting entropy.
 * @return {array} - An array of singular and plural systems of units.
 */
function unitWords() {
  const words = []
  const metricPrefixes = [ 
    // Smallest to largest.
    "quecto", "ronto", "yocto", "zepto", "atto", "femto", "pico", "nano",
    "micro", "milli", "centi", "deci", "", "deca", "hecto", "kilo", "mega",
    "giga", "tera", "peta", "exa", "zetta", "yotta", "ronna", "quetta",
    // Obsolete.
    "demi", "dimi", "double", "hebdo", "hepto", "micri", "myria", "octo",
    // Proposed, alphabetical.
    "chici", "dea", "ento", "fito", "grouchi", "groucho", "gummi", "harpi",
    "harpo", "hepa", "huna", "hunto", "kono", "nea", "nina", "ninto",
    "novetta", "otta", "revo", "sorta", "syto", "tena", "tento", "tousa",
    "touto", "treda", "tredo", "uda", "udeka", "udeko", "una", "vendeka",
    "vendeko", "vunda", "vundo", "weco", "weka", "xenna", "xona", "zeppi",
  ]
  const metricUnits = [
    // Alphabetical.
    "abampere", "abcoulomb", "abhenry", "abohm", "abvolt", "ampere",
    "apostilb", "barye", "becquerel", "biot", "bril", "candela", "celcius",
    "coulomb", "curie", "dalton", "day", "decibel", "dyne", "erg", "farad",
    "gal", "gauss", "gram", "grave", "gray", "hectare", "henry", "hertz",
    "hour", "joule", "katal", "kelvin", "litre", "lumen", "lux", "maxwell",
    "metre", "minute", "mole", "neper", "newton", "oersted", "ohm", "pascal",
    "phot", "poise", "radian", "rayleigh", "roentgen", "second", "seimens",
    "sievert", "skot", "statcoulomb", "statvolt", "steradian", "stilb",
    "stokes", "tesla", "tonne", "torr", "volt", "watt", "weber",
  ]
  const storagePrefixes = [
    // Smallest to largest paired as "base-2, base-10".
    "", "kibi", "kilo", "mebi", "mega", "gibi", "giga", "tebi", "tera", "pebi",
    "peta", "exbi", "exa", "zebi", "zetta", "yobi", "yotta", "robi", "ronna",
    "quebi", "quetta",
    // Unofficial.
    "bronto", "gego", "geo", "geop", "hella",
  ]
  const storageUnits = [
    // Alphabetical.
    "binit", "bit", "byte", "dit", "hartley", "nat", "nibble", "nit", "qubit",
    "qudit", "qutrit", "shannon", "trit", "tryte",
  ]
  const magnitudeUnits = [
    // Shortest to longest. Stopping at 10^123.
    "m", "b", "tr", "quadr", "quint", "sext", "sept", "oct", "non", "dec",
    "undec", "duodec", "tredec", "quattuordec", "quintdec", "sedec",
    "septendec", "octodec", "novendec", "vigint",
    // Fictional.
    "baj", "baz", "cs", "gaz", "j", "mustm", "squ", "z",
  ]
  const magnitudeSuffixes = [
    // Smallest to longest. Using traditional Peletier long scale due to being
    // shorter.
    "illiardth", "illionth", "illiard", "illion",
  ]

  // Metric System
  for (let i = 0; i < metricPrefixes.length; i++) {
    for (let j = 0; j < metricUnits.length; j++) {
      const word = metricPrefixes[i] + metricUnits[j]
      words.push(word)
      word.match(/(s|x|z)$/) ? words.push(word + "es") : words.push(word + "s")
    }
  }

  // Computer Storage
  for (let i = 0; i < storagePrefixes.length; i++) {
    for (let j = 0; j < storageUnits.length; j++) {
      const word = storagePrefixes[i] + storageUnits[j]
      words.push(word)
      words.push(word + "s")
    }
  }

  // Orders of magnitude
  for (let i = 0; i < magnitudeUnits.length; i++) {
    for (let j = 0; j < magnitudeSuffixes.length; j++) {
      const word = magnitudeUnits[i] + magnitudeSuffixes[j]
      words.push(word)
      words.push(word + "s")
    }
  }

  return words
}
