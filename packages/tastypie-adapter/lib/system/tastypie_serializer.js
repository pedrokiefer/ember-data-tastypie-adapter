var get = Ember.get, set = Ember.set, isNone = Ember.isNone;

var forEach = Ember.ArrayPolyfills.forEach;
var map = Ember.ArrayPolyfills.map;

DS.DjangoTastypieSerializer = DS.JSONSerializer.extend({

  init: function() {
    this._super.apply(this, arguments);
  },

  getItemUrl: function(meta, id){
    var url, store, adapter;
    
    store = this.get('store');
    adapter = store.adapterFor(meta);
    
    url = adapter.pathForType(meta.type.typeKey);
    return ["", adapter.get('namespace'), url, id, ""].join('/');
  },


  keyForRelationship: function(key, kind) {
    var attrs = get(this, 'attrs');
    
    if (attrs && attrs[key]) {
      return attrs[key];
    }
    
    return key + "_id";
  },
  
  normalize: function(type, hash, prop) {
    this.normalizeId(hash);
    this.normalizeUsingDeclaredMapping(type, hash);
    this.normalizeAttributes(type, hash);
    this.normalizeRelationships(type, hash);

    if (this.normalizeHash && this.normalizeHash[prop]) {
      return this.normalizeHash[prop](hash);
    }

    return this._super(type, hash, prop);
  },
  
  /**
    @method normalizeId
    @private
  */
  normalizeId: function(hash) {
    var primaryKey = get(this, 'primaryKey');

    if (primaryKey === 'id') { return; }

    hash.id = hash[primaryKey];
    delete hash[primaryKey];
  },

  /**
    @method normalizeUsingDeclaredMapping
    @private
  */
  normalizeUsingDeclaredMapping: function(type, hash) {
    var attrs = get(this, 'attrs'), payloadKey, key;

    if (attrs) {
      for (key in attrs) {
        payloadKey = attrs[key];

        hash[key] = hash[payloadKey];
        delete hash[payloadKey];
      }
    }
  },

  /**
    @method normalizeAttributes
    @private
  */
  normalizeAttributes: function(type, hash) {
    var payloadKey, key;

    if (this.keyForAttribute) {
      type.eachAttribute(function(key) {
        payloadKey = this.keyForAttribute(key);
        if (key === payloadKey) { return; }

        hash[key] = hash[payloadKey];
        delete hash[payloadKey];
      }, this);
    }
  },

  /**
    @method normalizeRelationships
    @private
  */
  normalizeRelationships: function(type, hash) {
    var payloadKey, key;

    if (this.keyForRelationship) {
      type.eachRelationship(function(key, relationship) {
        payloadKey = this.keyForRelationship(key, relationship.kind);
        if (key === payloadKey) { return; }

        hash[key] = hash[payloadKey];
        delete hash[payloadKey];
      }, this);
    }
  },

  /**
    ASSOCIATIONS: SERIALIZATION
    Transforms the association fields to Resource URI django-tastypie format
  */
  serializeBelongsTo: function(record, json, relationship) {
    var key = relationship.key;
    //var embedded = this.embeddedType(record.constructor, key);
    var belongsTo = get(record, key);

    key = this.keyForRelationship ? this.keyForRelationship(key, "belongsTo") : key;

    if (isNone(belongsTo)) {
      json[key] = belongsTo;
    } else {
      //if (embedded === 'always') {
      //  hash[key] = belongsTo.serialize();
      //} else {
        json[key] = this.getItemUrl(relationship, get(belongsTo, 'id'));
      //}
    }

    if (relationship.options.polymorphic) {
      this.serializePolymorphicType(record, json, relationship);
    }
  },

  serializeHasMany: function(record, json, relationship) {
    var key   = relationship.key,
        attrs = get(this, 'attrs'),
        embed = attrs && attrs[key] && attrs[key].embedded === 'always';

    if (embed) {
      json[key] = get(record, key).map(function(relation) {
        var data = relation.serialize(),
            primaryKey = get(this, 'primaryKey');

        data[primaryKey] = get(relation, primaryKey);

        return data;
      }, this);
    } else {
      json[key] = get(record, key).map(function(relation) {        
        this.getItemUrl(relation, get(relation, 'id'));
      });
    }
  },

  extractSingle: function(store, primaryType, payload, recordId, requestType) {
    console.log("Store: ", store);
    console.log("Type: ", primaryType.typeKey);
    console.log("Payload: ", payload);
    console.log("RecordID: ", recordId);
    console.log("requestType: ", requestType);
    
    updatePayloadWithEmbedded(store, this, primaryType, payload);
    
    var reference = this.normalize(primaryType, payload);
    console.log("reference: ", reference);
    
    return reference;
  },
  
  extractArray: function(store, primaryType, payload, recordId, requestType) {
    console.log("Store: ", store);
    console.log("Type: ", primaryType);
    console.log("Payload: ", payload);
    console.log("RecordID: ", recordId);
    console.log("requestType: ", requestType);
    var references = [];
    
    if (payload.objects) {
      var objects = payload.objects;
      
      for (var i = 0; i < objects.length; i++) {
        var reference = this.normalize(primaryType, objects[i]);
        references.push(reference);
      }
      delete payload.objects;
    }
    
    return references;
  },

  /**
    ASSOCIATIONS: DESERIALIZATION
    Transforms the association fields from Resource URI django-tastypie format
  */
  _deurlify: function(value) {
    if (typeof value === "string") {
      return value.split('/').reverse()[1];
    } else {
      return value;
    }
  },

  extractHasMany: function(type, hash, key) {
    var value,
      self = this;

    value = hash[key];

    if (!!value) {
      value.forEach(function(item, i, collection) {
        collection[i] = self._deurlify(item);
      });
    }

    return value;
  },

  extractBelongsTo: function(type, hash, key) {
    var value = hash[key];

    if (!!value) {
      value = this._deurlify(value);
    }
    return value;
  },
  
  serializeIntoHash: function(hash, type, record, options) {
    var serial = this.serialize(record, options);
    for (var property in serial) {
      if (serial.hasOwnProperty(property)) {
        hash[property] = serial[property];
      }
    }
  }

});

function updatePayloadWithEmbedded(store, serializer, type, payload) {
  var attrs = get(serializer, 'attrs');

  if (!attrs) {
    return;
  }
  
  type.eachRelationship(function(key, relationship) {
    var expandedKey, embeddedTypeKey, attribute, ids,
        config = attrs[key],
        serializer = store.serializerFor(relationship.type.typeKey),
        primaryKey = get(serializer, "primaryKey");

    if (relationship.kind !== "hasMany") {
      return;
    }

    if (config && (config.embedded === 'always' || config.embedded === 'load')) {
      // underscore forces the embedded records to be side loaded.
      // it is needed when main type === relationship.type
      embeddedTypeKey = '_' + relationship.type.typeKey;
      expandedKey = this.keyForRelationship(key, relationship.kind);
      attribute  = this.keyForAttribute ? this.keyForAttribute(key) : key;
      ids = [];

      /*
      if (!partial[attribute]) {
        return;
      }

      payload[embeddedTypeKey] = payload[embeddedTypeKey] || [];

      forEach(partial[attribute], function(data) {
        var embeddedType = store.modelFor(relationship.type.typeKey);
        updatePayloadWithEmbedded(store, serializer, embeddedType, data, payload);
        ids.push(data[primaryKey]);
        payload[embeddedTypeKey].push(data);
      });

      partial[expandedKey] = ids;
      delete partial[attribute];
      */
      console.log(embeddedTypeKey, payload[embeddedTypeKey]);
    }
  }, serializer);
}

