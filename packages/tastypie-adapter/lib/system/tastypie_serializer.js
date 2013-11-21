var get = Ember.get, set = Ember.set, isNone = Ember.isNone, merge = Ember.merge;

var map = Ember.EnumerableUtils.map;
var forEach = Ember.EnumerableUtils.forEach;

DS.DjangoTastypieSerializer = DS.JSONSerializer.extend({

  init: function() {
    this._super.apply(this, arguments);
  },

  keyForAttribute: function (attr) {
    return Ember.String.decamelize(attr);
  },
  
  keyForRelationship: function (key, kind) {
    return Ember.String.decamelize(key);
  },

  normalizePayload: function (type, payload) {
    return payload;
  },

  normalize: function (type, hash, prop) {
    this.normalizeId(hash);
    this.normalizeUsingDeclaredMapping(type, hash);
    this.normalizeAttributes(type, hash);
    this.normalizeRelationships(type, hash);

    return this._super(type, hash, prop);
  },

  normalizeId: function (hash) {
    hash.id = this.resourceUriToId(hash['resource_uri']);
    delete hash['resource_uri'];
  },
  
  normalizeUsingDeclaredMapping: function(type, hash) {
    var attrs = get(this, 'attrs'), payloadKey, key;

    if (attrs) {
      for (key in attrs) {
        if (typeof attrs[key] === 'object') {
          payloadKey = attrs[key].key ? attrs[key].key : key;
        } else {
          payloadKey = attrs[key];
        }
        
        if (key === payloadKey) { return; }

        hash[key] = hash[payloadKey];
        delete hash[payloadKey];
      }
    }
  },

  normalizeAttributes: function (type, hash) {
    var payloadKey, key;
    if (this.keyForAttribute) {
      type.eachAttribute(function (key) {
        payloadKey = this.keyForAttribute(key);
        if (key === payloadKey) {
          return;
        }

        hash[key] = hash[payloadKey];
        delete hash[payloadKey];
      }, this);
    }
  },

  resourceUriToId: function (resourceUri){
    return resourceUri.split('/').reverse()[1];
  },

  relationshipToResourceUri: function (relationship, value){
    if (!value) 
      return value;

    var store = relationship.type.store, 
        typeKey = relationship.type.typeKey;
    
    return store.adapterFor(typeKey).buildURL(typeKey, get(value, 'id'));
  },

  /**
  @method normalizeRelationships
  @private
  */
  normalizeRelationships: function (type, hash) {
    var payloadKey, key, self = this;

    type.eachRelationship(function (key, relationship) {
      if (this.keyForRelationship) {
        payloadKey = this.keyForRelationship(key, relationship.kind);
        if (key !== payloadKey) {
          hash[key] = hash[payloadKey];
          delete hash[payloadKey];
        }
      }
      if (hash[key]) {
        if (relationship.kind === 'belongsTo'){
          hash[key] = this.resourceUriToId(hash[key]);
        } else if (relationship.kind === 'hasMany'){
          var ids = [];
          hash[key].forEach(function (resourceUri){
            ids.push(self.resourceUriToId(resourceUri));
          });
          hash[key] = ids;
        }
      }
    }, this);
  },

  extractSingle: function (store, primaryType, payload, recordId, requestType) {
    extractEmbeddedFromPayload.call(this, store, primaryType, payload);
    payload = this.normalizePayload(primaryType, payload);
    return this.normalize(primaryType, payload, primaryType.typeKey);
  },

  extractArray: function (store, primaryType, payload) {
    var records = [];
    var self = this;
    payload.objects.forEach(function (hash) {
      extractEmbeddedFromPayload.call(self, store, primaryType, hash);
      records.push(self.normalize(primaryType, hash, primaryType.typeKey));
    });
    return records;
  },

  pushPayload: function (store, payload) {
    payload = this.normalizePayload(null, payload);

    return payload;
  },

  serialize: function (record, options) {
    var json = {};

    record.eachAttribute(function (key, attribute) {
      this.serializeAttribute(record, json, key, attribute);
    }, this);

    record.eachRelationship(function (key, relationship) {
      if (relationship.kind === 'belongsTo') {
        this.serializeBelongsTo(record, json, relationship);
      } else if (relationship.kind === 'hasMany') {
        this.serializeHasMany(record, json, relationship);
      }
    }, this);

    return json;
  },

  serializeIntoHash: function (data, type, record, options) {
    merge(data, this.serialize(record, options));
  },

  serializeBelongsTo: function (record, json, relationship) {
    this._super.apply(this, arguments);
    var key = relationship.key;
    key = this.keyForRelationship ? this.keyForRelationship(key, "belongsTo") : key;

    json[key] = this.relationshipToResourceUri(relationship, get(record, relationship.key));
  },

  serializeHasMany: function(record, json, relationship) {
    var key = relationship.key,
        attrs = get(this, 'attrs'),
        config = attrs && attrs[key] ? attrs[key] : false;
    key = this.keyForRelationship ? this.keyForRelationship(key, "belongsTo") : key;

    var relationshipType = DS.RelationshipChange.determineRelationshipType(record.constructor, relationship);

    if (relationshipType === 'manyToNone' || relationshipType === 'manyToMany' || relationshipType === 'manyToOne') {
      if (isEmbedded(config)) {
        json[key] = get(record, key).map(function (relation) {
          var data = relation.serialize();
          return data;
        });
      } else {
        json[key] = get(record, relationship.key).map(function (next){
            return this.relationshipToResourceUri(relationship, next);
        }, this);
      }
    }
  },

  serializePolymorphicType: function (record, json, relationship) {
    var key = relationship.key,
        belongsTo = get(record, key);
    key = this.keyForAttribute ? this.keyForAttribute(key) : key;
    json[key + "Type"] = belongsTo.constructor.typeKey;
  }
});

function isEmbedded(config) {
  return config && (config.embedded === 'always' || config.embedded === 'load');
}

function extractEmbeddedFromPayload(store, type, payload) {
  var attrs = get(this, 'attrs');

  if (!attrs) {
    return;
  }
  
  type.eachRelationship(function(key, relationship) {
    var config = attrs[key];

    if (isEmbedded(config)) {
      if (relationship.kind === "hasMany") {
        extractEmbeddedFromPayloadHasMany.call(this, store, key, relationship, payload, config);
      }
      if (relationship.kind === "belongsTo") {
        extractEmbeddedFromPayloadBelongsTo.call(this, store, key, relationship, payload, config);
      }
    }
  }, this);
}

function extractEmbeddedFromPayloadHasMany(store, primaryType, relationship, payload, config) {
  var serializer = store.serializerFor(relationship.type.typeKey),
      primaryKey = get(this, 'primaryKey');

  var attribute = config.key ? config.key : this.keyForAttribute(primaryType);
  var ids = [];

  if (!payload[attribute]) {
    return;
  }

  forEach(payload[attribute], function(data) {
    var embeddedType = store.modelFor(relationship.type.typeKey);
    
    extractEmbeddedFromPayload.call(serializer, store, embeddedType, data);
    
    data = serializer.normalize(embeddedType, data, embeddedType.typeKey);
    
    ids.push(serializer.relationshipToResourceUri(relationship, data));
    store.push(embeddedType, data);
  });

  payload[attribute] = ids;
}

function extractEmbeddedFromPayloadBelongsTo(store, primaryType, relationship, payload, config) {
  var serializer = store.serializerFor(relationship.type.typeKey),
      primaryKey = get(this, 'primaryKey');

  var attribute = config.key ? config.key : this.keyForAttribute(primaryType);

  if (!payload[attribute]) {
    return;
  }

  var data = payload[attribute];
  var embeddedType = store.modelFor(relationship.type.typeKey);
    
  extractEmbeddedFromPayload.call(serializer, store, embeddedType, data);
  
  data = serializer.normalize(embeddedType, data, embeddedType.typeKey); 
  payload[attribute] = serializer.relationshipToResourceUri(relationship, data);
  
  store.push(embeddedType, data);
}

