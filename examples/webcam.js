const regl = require('regl')()

require('../regl-webcam')({
  regl,
  done: (webcam) => {
    const draw = regl({
      vert: `
      precision highp float;
      attribute vec2 position;
      varying vec2 uv;
      void main () {
        uv = vec2(0.5 * (position.x + 1.0), 0.5 * (1.0 - position.y));
        gl_Position = vec4(position, 0, 1);
      }
      `,

      frag: `
      precision highp float;
      uniform sampler2D webcam;
      varying vec2 uv;
      void main () {
        gl_FragColor = texture2D(webcam, uv);
      }
      `,

      attributes: {
        position: [
          -4, 0,
          4, 4,
          4, -4
        ]
      },

      uniforms: {
        webcam
      },

      count: 3
    })

    regl.frame(() => {
      regl.clear({
        color: [0, 0, 0, 1],
        depth: 1
      })
      draw()
    })
  }
})
