const pMap = require('p-map')
const axios = require('axios')
const camelCase = require('camelcase')
const { isPlainObject, trimEnd } = require('lodash')

class CraftElementApiSource {
  static defaultOptions() {
    return {
      baseUrl: 'WEBSITE_URL',
      apiBase: 'api/gridsome',
      concurrent: 10,
      typeName: 'craft',
      elementTypes: [
        'asset',
        'category',
        'entry',
        'globalSet',
        'matrixBlock',
        'tag',
        'user',
      ]
    }
  }

  constructor(api, options) {
    this.options = options

    if (!options.typeName) {
      throw new Error(`Missing typeName option.`)
    }

    const baseUrl = trimEnd(options.baseUrl, '/')

    this.client = axios.create({
      baseURL: `${baseUrl}/${options.apiBase}`
    })

    this.idsPerElement = {}
    

    api.loadSource(async actions => {
      this.actions = actions

      this.idsPerElement = await this.collectionNodeIds()
      console.log(`Loading data from ${baseUrl}`)
      
      await this.getAll(actions)
    })
  }

  async getListOfIdsPerElementType() {
    let elementTypesIdsObject = {}

    for (const elementType of this.options.elementTypes) {
      const res = await this.fetch(`elementsId/${elementType}.json`)
      elementTypesIdsObject[elementType] = res.data.data.flatMap(item => item.id)
    }

    return elementTypesIdsObject;
  }

  async collectionNodeIds(actions) {
    let collectionNodeIdsObject = {}
    const self = this

    for (const elementType of this.options.elementTypes) {
      const res = await this.fetch(`elementsId/${elementType}.json`)
      res.data.data.forEach( item => {
        const collectionName = self.createCollectionName(elementType, item.type)
        collectionNodeIdsObject[collectionName] = collectionNodeIdsObject[collectionName] || []
        collectionNodeIdsObject[collectionName].push(item.id)
      })
    }

    return collectionNodeIdsObject;
  }

  async getAll(actions, idsPerElement) {
    const { addCollection, getCollection, createReference } = actions
    const self = this

    for (const elementType of this.options.elementTypes) {
      
      //Create Collections
      const collectionNamesArray = Object.keys(this.idsPerElement)
      collectionNamesArray.forEach(collectionName => {
        addCollection(collectionName)
      })
      
      const data = await this.fetchPaged(`elements/${elementType}.json`)

      for (const entry of data) {
        const collectionName = this.getCollectionNameFromId(entry.id)

        const collection = getCollection(collectionName)

        let fields = this.normalizeFields(entry)

        collection.addReference('author', 'CraftUser')

        // Owner is breaking the graphql build
        if (elementType === 'matrixBlock') delete fields.owner

        const node = entry.uri
          ? { 
            ...fields, 
            id: entry.id, 
            author: entry.authorId, 
          }
          : {
              ...fields,
              id: entry.id,
            }
        collection.addNode(node)
      }
    }
  }

  getCollectionNameFromId(idVal) {
    const collectionNamesArray = Object.keys(this.idsPerElement)
    const collectionName = collectionNamesArray.find(collection => this.idsPerElement[collection].find( id => id == idVal ) )
    return collectionName
  }

  async fetch(url, params = {}, fallbackData = []) {
    let res

    try {
      res = await this.client.request({ url, params })
    } catch ({ response, code, config }) {
      if (!response && code) {
        throw new Error(`${code} - ${config.url}`)
      }

      const { url } = response.config
      const { status } = response.data

      if ([401, 403].includes(status)) {
        console.warn(`Error: Status ${status} - ${url}`)
        return { ...response, data: fallbackData }
      } else {
        //throw new Error(`${status} - ${url}`)
      }
    }

    return res
  }

  async fetchPaged(path) {
    const { concurrent } = this.options

    return new Promise(async (resolve, reject) => {
      let res

      try {
        res = await this.fetch(path)
      } catch (err) {
        return reject(err)
      }

      const totalItems = parseInt(res.data.meta.pagination['total'], 10)
      const totalPages = parseInt(res.data.meta.pagination['total_pages'], 10)

      try {
        res.data = ensureArrayData(path, res.data.data)
      } catch (err) {
        return reject(err)
      }

      if (!totalItems || totalPages <= 1) {
        return resolve(res.data)
      }

      const queue = []

      for (let page = 2; page <= totalPages; page++) {
        queue.push({ page: page })
      }

      await pMap(
        queue,
        async params => {
          try {
            const { data } = await this.fetch(path, params)
            res.data.push(...ensureArrayData(path, data.data))
          } catch (err) {
            console.log(err.message)
          }
        },
        { concurrency: concurrent }
      )

      resolve(res.data)
    })
  }

  normalizeFields(fields) {
    const res = {}

    for (const key in fields) {
      let field = fields[key]
           
      // Flakey assumption: Objects with `int` keys are Matrix fields.
      // Change these to be an array (numbered keys not required)
      if (
        isPlainObject(fields[key]) &&
        Object.keys(fields[key]).every(k => !isNaN(k))
      ) {
        field = Object.values(fields[key])
      }
      res[camelCase(key)] = this.normalizeFieldValue(field)
    }
    return res
  }

  normalizeFieldValue(value) {
    const self = this

    if (value === null) return null
    if (value === undefined) return null

    if (Array.isArray(value)) {
      const ElementTypesArray = Object.keys(self.idsPerElement)
      let ElementType = ''
      
      return value.map(v => {
        if (Number.isInteger(Number(v))) {
          return this.actions.createReference(self.getCollectionNameFromId(v), v || '0')
        }

        return this.normalizeFieldValue(v)
      })
    }

    if (isPlainObject(value)) {
      if (value.post_type && (value.ID || value.id)) {
        const typeName = this.createCollectionName(value.post_type)
        const id = value.ID || value.id

        return this.actions.createReference(self.getCollectionNameFromId(id), id)
      } else if (value.filename && (value.ID || value.id)) {
        const typeName = this.createCollectionName(TYPE_ATTACHEMENT)
        const id = value.ID || value.id

        return this.actions.createReference(self.getCollectionNameFromId(id), id)
      } else if (value.hasOwnProperty('rendered')) {
        return value.rendered
      }
      return this.normalizeFields(value)
    }

    return value
  }

  createCollectionName(name = '', subtype = '') {
    const collectionName = subtype ? `${name} ${subtype}` : name
    return camelCase(`${this.options.typeName} ${collectionName}`, { pascalCase: true })
  }
}

function ensureArrayData(url, data) {
  if (!Array.isArray(data)) {
    try {
      data = JSON.parse(data)
    } catch (err) {
      throw new Error(
        `Failed to fetch ${url}\n` +
          `Expected JSON response but received:\n` +
          `${data.trim().substring(0, 150)}...\n`
      )
    }
  }
  return data
}

module.exports = CraftElementApiSource
