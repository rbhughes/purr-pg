#!/usr/bin/env node
const { spawn } = require('child_process')
const program = require('commander')
const parser = require('./parser')

program
  .option('-d, --dbname <dbname>', 'database name to connect to', 'ppdm39')
  .option('-u, --username <username>', 'database user name', 'ppdm_user')
  .option('-p, --password <password>', 'password for user', 'ppdm_pass')
  .option('-s, --schema <schema>', 'postgres schema', 'ppdm')
  .option('-t, --table <table>', 'ppdm table', 'well')
  .parse(process.argv)

let env = Object.create(process.env)
env.PGPASSWORD = program.password

let pgOut

const child = spawn(
  'psql',
  ['-d', program.dbname, '-U', program.username, '-c', `\\d ${program.schema}.${program.table}`],
  { env: env }
)

child.stdout.on('data', data => {
  pgOut += data.toString()
})

child.on('exit', code => {
  if (code !== 0) {
    console.log(`sad exit code: ${code}`)
  }
  let plan = parser.ppdmPurrPlan(pgOut)
  console.log(plan)
})

child.stderr.on('data', data => {
  console.log(data.toString())
})
