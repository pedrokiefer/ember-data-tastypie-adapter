Ember.onLoad('Ember.Application', function(Application) {
  Application.initializer({
    name: "tastypieModelAdapter",

    initialize: function(container, application) {
      application.register('serializer:_djangoTastypie', DS.DjangoTastypieSerializer);
      application.register('adapter:_djangoTastypie', DS.DjangoTastypieAdapter);
    }
  });
});