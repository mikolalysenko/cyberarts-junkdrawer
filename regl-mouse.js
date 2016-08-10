var mouseChange = require('mouse-change')

module.exports = function (regl) {
  var container = regl._gl.canvas
  var currentMouse = [-1, -1]
  var prevMouse = [-1, -1]
  var mouseVelocity = [0, 0]
  var lastTick = Date.now()
  var mouse = mouseChange(container, function (buttons, x, y) {
    var tick = Date.now()
    var bounds = container.getBoundingClientRect()
    var mx = 2.0 * (x - bounds.left) / bounds.width - 1.0
    var my = 1.0 - 2.0 * (y - bounds.top) / bounds.height
    var px = currentMouse[0]
    var py = currentMouse[1]

    var dt = tick - lastTick

    currentMouse[0] = mx
    currentMouse[1] = my
    prevMouse[0] = px
    prevMouse[1] = py
    mouseVelocity[0] = (mx - px) / dt
    mouseVelocity[1] = (my - py) / dt
  })

  return regl({
    context: {
      mousePosition: function () { return currentMouse },
      mouseVelocity: function () { return mouseVelocity },
      mouseButtons: function () { return mouse.buttons }
    },
    uniforms: {
      mousePosition: regl.context('mousePosition'),
      mouseVelocity: regl.context('mouseVelocity'),
      mouseButtons: function () {
        return [
          !!(mouse.buttons & 1),
          !!(mouse.buttons & 2),
          !!(mouse.buttons & 4),
          !!(mouse.buttons & 8)
        ]
      }
    }
  })
}
