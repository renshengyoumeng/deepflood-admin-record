require("dotenv/config");

const { ofetch } = require("ofetch");
const cheerio = require('cheerio');
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function save(id, data) {
  const record = await prisma.deepFloodAdminRecord.upsert({
    create: { id, data: JSON.stringify(data) },
    where: { id },
    update: { data: JSON.stringify(data) },
  })
  return record
}

async function getTotalCount() {
  const count = await prisma.deepFloodAdminRecord.count()
  return count
}

async function getMaxId() {
  const lastUser = await prisma.deepFloodAdminRecord.findFirst({
    orderBy: {
      id: 'desc',
    },
    select: {
      id: true,
    },
  });

  return lastUser?.id;
}

async function getAdminRecordList(page) {
  const b = await ofetch('http://localhost:8191/v1', {
    method: "POST",
    body: {
      "url": "https://www.deepflood.com/api/admin/ruling/page-" + page,
      "cmd": "request.get",
      "maxTimeout": 60000,
      "cookies": [
        { "name": "session", "value": process.env.DF_SESSION }
      ]
    },
  })

  if (b && b.status === 'ok' && b.solution?.status === 200) {
    const response = b.solution.response
    const $ = cheerio.load(response);
    const p = $('pre').text()

    const adminRecordResult = JSON.parse(p)
    return adminRecordResult.data
  }
}

async function getAdminRecord(id) {
  const b = await ofetch('http://localhost:8191/v1', {
    method: "POST",
    body: {
      "url": "https://www.deepflood.com/api/admin/ruling/id-" + id,
      "cmd": "request.get",
      "maxTimeout": 60000,
      "cookies": [
        { "name": "session", "value": process.env.DF_SESSION }
      ]
    },
  })

  if (b && b.status === 'ok' && b.solution?.status === 200) {
    const response = b.solution.response
    const $ = cheerio.load(response);
    const p = $('pre').text()

    const adminRecordResult = JSON.parse(p)
    return adminRecordResult.data
  }
}

async function main() {
  let isMax = false
  let count = 0
  let i = 1
  while (!isMax) {
    const maxId = await getMaxId() ?? 0
    const adminRecordList = await getAdminRecordList(i)

    if (!adminRecordList) {
      console.error('获取数据异常，请检查')
    }

    for (let record of adminRecordList) {
      if (record.id <= maxId) {
        const totalCount = await getTotalCount()
        console.log('已经是最新数据了,最新的id是' + record.id)
        console.log('当前表中存在' + totalCount + '条数据')
        console.log(totalCount == record.id ? '数据正常' : '存在缺失数据')
        isMax = true
        return
      }
      count++
      await save(record.id, record)
    }
    i++
  }

  console.log('新增了' + count + '条数据')
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })


