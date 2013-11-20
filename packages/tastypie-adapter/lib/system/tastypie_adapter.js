require('tastypie-adapter/system/tastypie_serializer');

var get = Ember.get, set = Ember.set;

DS.DjangoTastypieAdapter = DS.RESTAdapter.extend({

  /**
    This is the default Tastypie namespace found in the documentation.
    You may change it if necessary when creating the adapter
  */
  namespace: "api/v1",

  /**
    Serializer object to manage JSON transformations
  */
  defaultSerializer: '_djangoTastypie',
  
  /**
    django-tastypie does not pluralize names for lists
  */
  pathForType: function(type) {
    return type;
  },
  
  buildURL: function(type, id) {
    var url = this._super(type, id);
    // Add the trailing slash to avoid setting requirement in Django.settings
    if (url.charAt(url.length -1) !== '/') {
      url += '/';
    }
    return url;
  },

  findMany: function(store, type, ids, owner) {
    var url;

    // FindMany array through subset of resources
    if (ids instanceof Array) {
      ids = "set/" + ids.join(";") + '/';
    }

    url = this.buildURL(type.typeKey);
    url += ids;

    return this.ajax(url, "GET", { data: {} });
  }
});
