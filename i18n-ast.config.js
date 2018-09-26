module.exports = {
  entry: "./example/test", //需要解析的路径
  output: "./example/test2", //导出路径
  outputFilename: "test.js", //导出文件名
  prefix: 'test', //导出类名
  toolPath: 'common/tools', //tool 路径
  exclude: ['*.jsx'], //排除的文件
  // 导出key值 这里取`文件名` + `_` + `随机数`
  randomFuc: (filePath) => {
    return `${filePath.split('/').pop().split('.').shift()}_${
      Math.random().toString().split('.').pop()
    }`
  }
}