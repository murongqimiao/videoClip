const fs = require('fs')

var htmlContent = fs.readFileSync('./docs/index.html', 'utf-8')
console.log(htmlContent)
htmlContent = htmlContent.replace(/\/static/g, '/videoClip/static')
htmlContent = htmlContent.replace(/\/favicon\.ico/g, '/videoClip/favicon.ico')
htmlContent = htmlContent.replace(/\/manifest\.json/g, '/videoClip/manifest.json')
console.log(htmlContent)
fs.writeFileSync('./docs/index.html', htmlContent)
