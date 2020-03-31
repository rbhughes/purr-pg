#!/usr/bin/env node
const {spawn} = require('child_process')
const program = require('commander')
const parser = require('./parser')

program
  .option('-d, --dbname <dbname>', 'database name to connect to', 'ppdm39')
  .option('-u, --username <username>', 'database user name', 'ppdm_user')
  .option('-p, --password <password>', 'password for user', 'ppdm_pass')
  .option('-s, --schema <schema>', 'postgres schema', 'ppdm')
  //.option('-t, --table <table>', 'ppdm table', 'well')
  .parse(process.argv)

//console.log(`dbname   = ${program.dbname}`)
//console.log(`username = ${program.username}`)
//console.log(`password = ${program.password}`)

//psql -d ppdm39 -U ppdm_user -c "\d ppdm.well"

process.env.PGPASSWORD = 'ppdm_pass'

const child = spawn('psql', [
  '-d',
  program.dbname,
  '-U',
  program.username,
  '-c',
  `\\dt ${program.schema}.*`
])
child.on('exit', code => {
  console.log(`Exit code is: ${code}`)
})
child.stderr.on('data', data => {
  console.log(data.toString())
})

child.stdout.on('data', data => {
  console.log(data.toString())
  console.log('-----------')
  //console.log(parser.punk('asdf'))
})
