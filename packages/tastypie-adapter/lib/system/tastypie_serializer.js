var get = Ember.get, set = Ember.set;

var forEach = Ember.ArrayPolyfills.forEach;
var map = Ember.ArrayPolyfills.map;

DS.DjangoTastypieSerializer = DS.RESTSerializer.extend({

  init: function() {
    this._super.apply(this, arguments);
  },

  getItemUrl: function(meta, id){
    var url;

    url = get(this, 'adapter').rootForType(meta.type);
    return ["", get(this, 'namespace'), url, id, ""].join('/');
  },


  keyForBelongsTo: function(type, name) {
    return this.keyForAttributeName(type, name) + "_id";
  },

  /**
    ASSOCIATIONS: SERIALIZATION
    Transforms the association fields to Resource URI django-tastypie format
  */
  addBelongsTo: function(hash, record, key, relationship) {
    var id,
        related = get(record, relationship.key),
        embedded = this.embeddedType(record.constructor, key);

    if (embedded === 'always') {
      hash[key] = related.serialize();

    } else {
      id = get(related, this.primaryKey(related));

      if (!Ember.isNone(id)) { hash[key] = this.getItemUrl(relationship, id); }
    }
  },

  addHasMany: function(hash, record, key, relationship) {
    var self = this,
        serializedValues = [],
        id = null,
        embedded = this.embeddedType(record.constructor, key);

    key = this.keyForHasMany(relationship.type, key);

    var value = record.get(key) || [];

    value.forEach(function(item) {
      if (embedded === 'always') {
        serializedValues.push(item.serialize());
      } else {
        id = get(item, self.primaryKey(item));
        if (!Ember.isNone(id)) {
          serializedValues.push(self.getItemUrl(relationship, id));
        }
      }
    });

    hash[key] = serializedValues;
  },

  extractSingle: function(store, primaryType, payload, recordId, requestType) {
    console.log("Store: ", store);
    console.log("Type: ", primaryType.typeKey);
    console.log("Payload: ", payload);
    console.log("RecordID: ", recordId);
    console.log("requestType: ", requestType);
    
    var primaryTypeName = primaryType.typeKey,
        primaryRecord;
    
    var typeSerializer = store.serializerFor(primaryTypeName);
    var hash = typeSerializer.normalize(primaryTypeName, payload);
    return hash;
  },
  
  extractMany: function(store, primaryType, payload) {
    console.log("Store: ", store);
    console.log("Type: ", primaryType);
    console.log("Payload: ", payload);
    
    var primaryTypeName = primaryType.typeKey,
        primaryArray;
        
    var typeName = this.typeForRoot(primaryTypeName),
        type = store.modelFor(typeName),
        typeSerializer = store.serializerFor(type);

      /*jshint loopfunc:true*/
      var normalizedArray = map.call(payload, function(hash) {
        return typeSerializer.normalize(type, hash);
      }, this);

        primaryArray = normalizedArray;

    return primaryArray;
  },

  extractMeta: function(store, type, payload) {
    var data = payload, value;

    if(payload && payload['meta']){
      data = payload['meta'];

      this.metadataMapping.forEach(function(property, key){
        if(value = data[property]){
          store.metaForType(type, key, value);
        }
      });
      delete payload.meta;
    }
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
  }

});

