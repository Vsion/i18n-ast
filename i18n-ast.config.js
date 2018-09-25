module.exports = {
  entry: "./test",
  output: "./test2",
  outputFilename: "test.js",
  prefix: 'test',
   //排除的文件（类型是数组）
  exclude: ['*.jsx'],
  //可以自定义随机字符串，第一个参数是当前文件的路径
  randomFuc: (filePath) => {
    return `${filePath.split('/').pop().split('.').shift()}_${
      Math.random().toString().split('.').pop()
    }`
  }
}