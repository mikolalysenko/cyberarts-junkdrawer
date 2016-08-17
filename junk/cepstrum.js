const regl = require('regl')()

const drawCepstrum = regl({
  vert: `
  precision highp float;

  attribute float cep, que;

  void main () {
    gl_Position = vec4(cep, que, 0, 1);
  }
  `,

  frag: `
  void main () {
    gl_FragColor = vec4(1, 1, 1, 1);
  }
  `,

  attributes: {
    cep: Array(1024).fill(0).map((_, i) => i / 512 - 1.0),
    que: ({cepstrum}) => new Float32Array(cepstrum)
  },

  count: 1024,
  primitive: 'line strip'
})

require('../regl-microphone')({
  regl,
  beats: 16,
  done: (microphone) => {
    regl.frame(() => {
      microphone(({beats}) => {
        regl.clear({
          color: [0, 0, 0, 1]
        })
        drawCepstrum()
      })
    })
  }
})
