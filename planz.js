const fs = require('fs')
const path = require('path')

let a = fs.readFileSync

/*
assumed order
----+----- (column header)
Indexes:
Check constraints:
Foreign-key constraints:
Referenced by:
*/

/*
                                      Table "ppdm.well"
*/
const getTableName = lines => {
  return lines[0].match(/\"ppdm\.(.*)\"/)[1]
}

/*
          Column           |              Type              | Collation | Nullable | Default 
---------------------------+--------------------------------+-----------+----------+---------
 uwi                       | character varying(40)          |           | not null | 
 abandonment_date          | timestamp(0) without time zone |           |          | 
 active_ind                | character varying(1)           |           |          | 
*/
const getColumns = (table, lines) => {
  const o = {}
  let capture = false
  for (line of lines) {
    line = line.trim()
    if (line.match(/\-*\+/)) {
      capture = true
      continue
    } else if (line === 'Indexes:') {
      capture = false
    } else {
      if (capture) {
        const x = line.split('|')
        let nullable = x[3].trim() === 'not null' ? false : true
        o[`${table}.${x[0].trim()}`] = {type: x[1].trim(), nullable: nullable}
      }
    }
  }
  return o
}

/*
Indexes:
    "w_pk" PRIMARY KEY, btree (uwi)
    "w_guid" UNIQUE CONSTRAINT, btree (ppdm_guid)
Check constraints:
*/
const getIndexes = (table, lines) => {
  let o = {}
  let capture = false
  for (line of lines) {
    line = line.trim()
    if (line === 'Indexes:') {
      capture = true
      continue
    } else if (line === 'Check constraints:') {
      capture = false
    } else {
      if (capture) {
        let cols = line
          .match(/\((.*)\)/)[1]
          .split(',')
          .map(x => `${table}.${x.trim()}`)

        o[`(${cols.join(',')})`] = {
          type: line.match(/([A-Z]+)/)[1].toLowerCase()
        }
      }
    }
  }
  return o
}

/*
Check constraints:
    "w_ck" CHECK (active_ind::text = ANY (ARRAY['Y'::character varying, 'N'::character varying]::text[]))
    "w_ck1" CHECK (discovery_ind::text = ANY (ARRAY['Y'::character varying, 'N'::character varying]::text[]))
    "w_ck2" CHECK (faulted_ind::text = ANY (ARRAY['Y'::character varying, 'N'::character varying]::text[]))
    "w_ck3" CHECK (platform_sf_subtype::text = 'SF_PLATFORM'::text)
Foreign-key constraints:
*/
const getCheckConstraints = (table, lines) => {
  let o = []
  let capture = false
  for (line of lines) {
    line = line.trim()
    if (line === 'Check constraints:') {
      capture = true
      continue
    } else if (line === 'Foreign-key constraints:') {
      capture = false
    } else {
      if (capture) {
        let col = `${table}.${line.match(/\((\D+?)::/)[1]}`
        o[col] = {
          type: line.match(/([A-Z]+)/)[1].toLowerCase(),
          rule: line.trim()
        }
      }
    }
  }
  return o
}

/*
Foreign-key constraints:
    "w_ba_fk" FOREIGN KEY (operator) REFERENCES business_associate(business_associate_id)
    "w_ba_fk2" FOREIGN KEY (regulatory_agency) REFERENCES business_associate(business_associate_id)
    "w_r_ws_fk" FOREIGN KEY (status_type, current_status) REFERENCES r_well_status(status_type, status)
    "w_stu_fk2" FOREIGN KEY (td_strat_name_set_age, td_strat_age) REFERENCES strat_unit(strat_name_set_id, strat_unit_id)
Referenced by:
*/
const getForeignKeyConstraints = (table, lines) => {
  let o = {}
  let capture = false
  for (line of lines) {
    line = line.trim()
    if (line === 'Foreign-key constraints:') {
      capture = true
      continue
    } else if (line === 'Referenced by:') {
      capture = false
    } else {
      if (capture) {
        let type = line.match(/([A-Z]+)/)[1].toLowerCase() //because all other names are lowercase

        let cols = line
          .match(/\((.+?)\)/)[1]
          .split(',')
          .map(x => `${table}.${x.trim()}`)

        let ftable = line.match(/REFERENCES(.*)\(/)[1].trim()
        let fcols = line
          .match(/REFERENCES.+\((.*)\)/)[1]
          .split(',')
          .map(x => `${ftable}.${x.trim()}`)

        // assumes a one-to-one relationship, in order
        cols.forEach((c, i) => {
          o[c] = fcols[i]
        })
      }
    }
  }
  return o
}

/*
Referenced by:
    TABLE "area_component" CONSTRAINT "acmp_w_fk" FOREIGN KEY (uwi) REFERENCES well(uwi)
    TABLE "anl_component" CONSTRAINT "anlcomp_w_fk" FOREIGN KEY (uwi) REFERENCES well(uwi)
    TABLE "ba_authority_comp" CONSTRAINT "baauc_w_fk" FOREIGN KEY (uwi) REFERENCES well(uwi)
*/
const getReferencedBy = lines => {
  let o = {}
  let capture = false
  for (line of lines) {
    line = line.trim()
    if (line === 'Referenced by:') {
      capture = true
      continue
    } else {
      if (capture && line.length > 1) {
        let table = line.match(/REFERENCES\s(.+?)\(/)[1]
        let ftable = line.match(/TABLE.\"(.+?)\"/)[1]

        let fcols = line
          .match(/FOREIGN\sKEY\s\((.+?)\)/)[1]
          .split(',')
          .map(x => `${ftable}.${x.trim()}`)

        let cols = line
          .match(/REFERENCES\s.+\((.+?)\)/)[1]
          .split(',')
          .map(x => `${table}.${x.trim()}`)

        fcols.forEach((c, i) => {
          o[c] = cols[i]
        })
      }
    }
  }
  return o
}

const collectPGMeta = base => {
  const o = {}
  fs.readdirSync(base).forEach(f => {
    const fp = path.join(base, f)
    //console.log(fp)

    try {
      //if (f.match(/r_well_status.txt$/)) {
      if (fp.match(/ppdm_well.txt$/)) {
        let lines = fs
          .readFileSync(fp)
          .toString()
          .split('\n')

        let table = getTableName(lines)
        let columns = getColumns(table, lines)
        let indexes = getIndexes(table, lines)
        let checks = getCheckConstraints(table, lines)
        let foreign_keys = getForeignKeyConstraints(table, lines)
        let referenced_by = getReferencedBy(lines)

        o['table'] = table
        o['columns'] = columns
        o['indexes'] = indexes
        o['checks'] = checks
        o['foreign_keys'] = foreign_keys
        o['referenced_by'] = referenced_by
      }
      //let plan = require(Path.resolve(base, tf))
      //if (plan.ppdm_group === group) {
      //  tables.push(plan.ppdm_table)
      //}
    } catch (exception) {
      //console.log('barf on ' + tf)
      console.log(exception)
      //if (!(exception instanceof SyntaxError)) { // skip malformed/empty json
      //  throw exception
      //}
    }
  })
  return o
}

let o = collectPGMeta('/home/bryan/dev/clowder/sanity')
console.log(o)
