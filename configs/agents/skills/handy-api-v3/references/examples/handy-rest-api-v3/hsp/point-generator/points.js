import Logger from '../../../log.js'
/**
 * @typedef {import('../../../handy-rest-api-v3-client.js').Point} Point
 */

/**
 * Generates random points within the provided ranges
 * @param {number} startTime 
 * @param {number} minPos
 * @param {number} maxPos 
 * @param {number} maxDuration
 * @param {number} minDuration
 * @param {number} pointCount 
 * @returns {Point[]}
 */
const RandomGenerator = (startTime, minPos, maxPos, minDuration, maxDuration, pointCount) => {
  Logger.debug(`RandomGenerator: startTime=${startTime}, minPos=${minPos}, maxPos=${maxPos}, minDuration=${minDuration}, maxDuration=${maxDuration}, pointCount=${pointCount}`)
  const points = []
  let prevTime = startTime
  for (let i = 0; i < pointCount; i++) {
    prevTime = Math.ceil(minDuration + Math.random() * (maxDuration - minDuration) + prevTime)
    points.push({
      x: Math.min(Math.ceil(minPos + Math.random() * (maxPos - minPos)), 100),
      t: prevTime
    })
  }
  Logger.debug(`RandomGenerator: points=${JSON.stringify(points)}`)
  return points
}

/**
 * Generates a wave pattern with the provided parameters.
 * @param {Point} prevPoint  The previous point.
 * @param {number} amplitude  The height of the wave.
 * @param {number} interval   The time between points (top, bottom).
 * @param {number} [pointCount]  The number of points to generate.
 * @returns {Point[]}
 */
const WaveGenerator = (prevPoint, amplitude, interval, pointCount = 100) => {
  pointCount = Math.min(100, pointCount)
  const points = []
  let prevPos = prevPoint.x
  let prevTime = prevPoint.t
  for (let x = 0; x < pointCount; x++) {
    prevPos = 50 + (prevPos <= 50 ? amplitude : -amplitude)
    prevTime += interval
    points.push({ t: prevTime, x: prevPos });
  }
  return points
}


export { RandomGenerator, WaveGenerator }