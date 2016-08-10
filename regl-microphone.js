const getUserMedia = require('getusermedia')
const reglAnalyser = require('./regl-analyser')

module.exports = function (options) {
  getUserMedia({audio: true}, function (err, stream) {
    if (err) {
      options.error && options.error(err)
      return
    }
    const context = new window.AudioContext()
    const analyser = context.createAnalyser()
    context.createMediaStreamSource(stream).connect(analyser)
    options.done(reglAnalyser(Object.assign({
      analyser,
      sampleRate: context.sampleRate
    }, options)))
  })
}
