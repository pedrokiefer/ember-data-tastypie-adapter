var get = Ember.get, set = Ember.set;
var HomePlanet, league, SuperVillain, superVillain, EvilMinion, YellowMinion, DoomsdayDevice, PopularVillain, Comment, Course, Unit, env;

module("integration/django_tastypie_adapter - DjangoTastypieSerializer", {
  setup: function() {
    SuperVillain = DS.Model.extend({
      firstName:     DS.attr('string'),
      lastName:      DS.attr('string'),
      homePlanet:    DS.belongsTo("homePlanet"),
      evilMinions:   DS.hasMany("evilMinion")
    });
    HomePlanet = DS.Model.extend({
      name:          DS.attr('string'),
      villains:      DS.hasMany('superVillain')
    });
    EvilMinion = DS.Model.extend({
      superVillain: DS.belongsTo('superVillain'),
      name:         DS.attr('string')
    });
    YellowMinion = EvilMinion.extend();
    DoomsdayDevice = DS.Model.extend({
      name:         DS.attr('string'),
      evilMinion:   DS.belongsTo('evilMinion', {polymorphic: true})
    });
    PopularVillain = DS.Model.extend({
      name:         DS.attr('string'),
      evilMinions:  DS.hasMany('evilMinion', {polymorphic: true})
    });
    Comment = DS.Model.extend({
      body: DS.attr('string'),
      root: DS.attr('boolean'),
      children: DS.hasMany('comment')
    });
    Course = DS.Model.extend({
      name: DS.attr('string'),
      prerequisiteUnits: DS.hasMany('unit'),
      units: DS.hasMany('unit')
    });
    Unit = DS.Model.extend({
      name: DS.attr('string')
    });
    env = setupStore({
      superVillain:   SuperVillain,
      homePlanet:     HomePlanet,
      evilMinion:     EvilMinion,
      yellowMinion:   YellowMinion,
      doomsdayDevice: DoomsdayDevice,
      popularVillain: PopularVillain,
      comment:        Comment,
      course:         Course,
      unit:           Unit,
      adapter: DS.DjangoTastypieAdapter
    });
    env.store.modelFor('superVillain');
    env.store.modelFor('homePlanet');
    env.store.modelFor('evilMinion');
    env.store.modelFor('yellowMinion');
    env.store.modelFor('doomsdayDevice');
    env.store.modelFor('popularVillain');
    env.store.modelFor('comment');
    env.store.modelFor('course');
    env.store.modelFor('unit');
    env.container.register('serializer:application', DS.DjangoTastypieSerializer);
    env.container.register('serializer:_djangoTastypie', DS.DjangoTastypieSerializer);
    env.container.register('adapter:_djangoTastypie', DS.DjangoTastypieAdapter);
    env.dtSerializer = env.container.lookup("serializer:_djangoTastypie");
    env.dtAdapter    = env.container.lookup("adapter:_djangoTastypie");
  },

  teardown: function() {
    env.store.destroy();
  }
});

test("serialize", function() {
  league = env.store.createRecord(HomePlanet, { name: "Villain League", id: "123" });
  var tom = env.store.createRecord(SuperVillain, { firstName: "Tom", lastName: "Dale", homePlanet: league });

  var json = env.dtSerializer.serialize(tom);

  deepEqual(json, {
    evilMinions: [],
    firstName: "Tom",
    lastName: "Dale",
    homePlanet_id: '/api/v1/homePlanet/'+get(league, "id")+'/'
  });
});

test("serializeIntoHash", function() {
  league = env.store.createRecord(HomePlanet, { name: "Umber", id: "123" });
  var json = {};

  env.dtSerializer.serializeIntoHash(json, HomePlanet, league);

  deepEqual(json, {
    name: "Umber",
    villains: []
  });
});

test("normalize", function() {
  var superVillain_hash = {firstName: "Tom", lastName: "Dale", homePlanet: "123", evilMinions: [1,2]};

  var json = env.dtSerializer.normalize(SuperVillain, superVillain_hash, "superVillain");

  deepEqual(json, {
    firstName: "Tom",
    lastName: "Dale",
    homePlanet: "123",
    evilMinions: [1,2]
  });
});

test("extractSingle", function() {
  env.container.register('adapter:superVillain', DS.DjangoTastypieAdapter);

  var json_hash = {
    id: "1", name: "Umber", villains: [1]
  };

  var json = env.dtSerializer.extractSingle(env.store, HomePlanet, json_hash);

  deepEqual(json, {
    "id": "1",
    "name": "Umber",
    "villains": [1]
  });
  
  env.store.find("superVillain", 1).then(async(function(minion){
    equal(minion.get('firstName'), "Tom");
  }));
});

test("extractSingle with embedded objects", function() {
  env.container.register('adapter:superVillain', DS.DjangoTastypieAdapter);
  env.container.register('serializer:homePlanet', DS.DjangoTastypieSerializer.extend({
    attrs: {
      villains: {embedded: 'always'}
    }
  }));

  var serializer = env.container.lookup("serializer:homePlanet");
  var json_hash = {
    id: "1",
    name: "Umber",
    villains: [{
      id: "1",
      first_name: "Tom",
      last_name: "Dale"
    }]
  };

  var json = serializer.extractSingle(env.store, HomePlanet, json_hash);

  deepEqual(json, {
    id: "1",
    name: "Umber",
    villains: ["1"]
  });
  env.store.find("superVillain", 1).then(async(function(minion) {
    equal(minion.get('firstName'), "Tom");
  }));
});

test("extractSingle with embedded objects inside embedded objects", function() {
  env.container.register('adapter:superVillain', DS.DjangoTastypieAdapter);
  env.container.register('serializer:homePlanet', DS.DjangoTastypieSerializer.extend({
    attrs: {
      villains: {embedded: 'always'}
    }
  }));
  env.container.register('serializer:superVillain', DS.DjangoTastypieSerializer.extend({
    attrs: {
      evilMinions: {embedded: 'always'}
    }
  }));

  var serializer = env.container.lookup("serializer:homePlanet");
  var json_hash = {
    id: "1",
    name: "Umber",
    villains: [{
      id: "1",
      firstName: "Tom",
      lastName: "Dale",
      evilMinions: [{
        id: "1",
        name: "Alex"
      }]
    }]
  };

  var json = serializer.extractSingle(env.store, HomePlanet, json_hash);

  deepEqual(json, {
    id: "1",
    name: "Umber",
    villains: ["1"]
  });
  env.store.find("superVillain", 1).then(async(function(villain) {
    equal(villain.get('firstName'), "Tom");
    equal(villain.get('evilMinions.length'), 1, "Should load the embedded child");
    equal(villain.get('evilMinions.firstObject.name'), "Alex", "Should load the embedded child");
  }));
  env.store.find("evilMinion", 1).then(async(function(minion) {
    equal(minion.get('name'), "Alex");
  }));
});

test("extractSingle with embedded objects of same type", function() {
  env.container.register('adapter:comment', DS.DjangoTastypieAdapter);
  env.container.register('serializer:comment', DS.DjangoTastypieSerializer.extend({
    attrs: {
      children: {embedded: 'always'}
    }
  }));

  var serializer = env.container.lookup("serializer:comment");
  var json_hash = {
    id: "1",
    body: "Hello",
    root: true,
    children: [{
      id: "2",
      body: "World",
      root: false
    },
    {
      id: "3",
      body: "Foo",
      root: false
    }]
  };
  var json = serializer.extractSingle(env.store, Comment, json_hash);

  deepEqual(json, {
    id: "1",
    body: "Hello",
    root: true,
    children: ["2", "3"]
  }, "Primary record was correct");
  equal(env.store.recordForId("comment", "2").get("body"), "World", "Secondary records found in the store");
  equal(env.store.recordForId("comment", "3").get("body"), "Foo", "Secondary records found in the store");
});

test("extractSingle with embedded objects inside embedded objects of same type", function() {
  env.container.register('adapter:comment', DS.DjangoTastypieAdapter);
  env.container.register('serializer:comment', DS.DjangoTastypieSerializer.extend({
    attrs: {
      children: {embedded: 'always'}
    }
  }));

  var serializer = env.container.lookup("serializer:comment");
  var json_hash = {
    id: "1",
    body: "Hello",
    root: true,
    children: [{
      id: "2",
      body: "World",
      root: false,
      children: [{
        id: "4",
        body: "Another",
        root: false
      }]
    },
    {
      id: "3",
      body: "Foo",
      root: false
    }]
  };
  var json = serializer.extractSingle(env.store, Comment, json_hash);

  deepEqual(json, {
    id: "1",
    body: "Hello",
    root: true,
    children: ["2", "3"]
  }, "Primary record was correct");
  equal(env.store.recordForId("comment", "2").get("body"), "World", "Secondary records found in the store");
  equal(env.store.recordForId("comment", "3").get("body"), "Foo", "Secondary records found in the store");
  equal(env.store.recordForId("comment", "4").get("body"), "Another", "Secondary records found in the store");
  equal(env.store.recordForId("comment", "2").get("children.length"), 1, "Should have one embedded record");
  equal(env.store.recordForId("comment", "2").get("children.firstObject.body"), "Another", "Should have one embedded record");
});

test("extractSingle with embedded objects of same type, but from separate attributes", function() {
  env.container.register('adapter:course', DS.DjangoTastypieAdapter);
  env.container.register('serializer:course', DS.DjangoTastypieSerializer.extend({
    attrs: {
      prerequisiteUnits: {embedded: 'always'},
      units: {embedded: 'always'}
    }
  }));

  var serializer = env.container.lookup("serializer:course");
  var json_hash = {
    id: "1",
    name: "Course 1",
    prerequisiteUnits: [{
      id: "1",
      name: "Unit 1"
    },{
      id: "3",
      name: "Unit 3"
    }],
    units: [{
      id: "2",
      name: "Unit 2"
    },{
      id: "4",
      name: "Unit 4"
    }]
  };
  var json = serializer.extractSingle(env.store, Course, json_hash);

  deepEqual(json, {
    id: "1",
    name: "Course 1",
    prerequisiteUnits: ["1", "3"],
    units: ["2", "4"]
  }, "Primary array was correct");

  equal(env.store.recordForId("unit", "1").get("name"), "Unit 1", "Secondary records found in the store");
  equal(env.store.recordForId("unit", "2").get("name"), "Unit 2", "Secondary records found in the store");
  equal(env.store.recordForId("unit", "3").get("name"), "Unit 3", "Secondary records found in the store");
  equal(env.store.recordForId("unit", "4").get("name"), "Unit 4", "Secondary records found in the store");
});

test("extractArray", function() {
  env.container.register('adapter:superVillain', DS.DjangoTastypieAdapter);

  var json_hash = {
    home_planets: [{id: "1", name: "Umber", villain_ids: [1]}],
    super_villains: [{id: "1", first_name: "Tom", last_name: "Dale", home_planet_id: "1"}]
  };

  var array = env.dtSerializer.extractArray(env.store, HomePlanet, json_hash);

  deepEqual(array, [{
    "id": "1",
    "name": "Umber",
    "villains": [1]
  }]);

  env.store.find("superVillain", 1).then(async(function(minion){
    equal(minion.get('firstName'), "Tom");
  }));
});

test("extractArray with embedded objects", function() {
  env.container.register('adapter:superVillain', DS.DjangoTastypieAdapter);
  env.container.register('serializer:homePlanet', DS.DjangoTastypieSerializer.extend({
    attrs: {
      villains: {embedded: 'always'}
    }
  }));

  var serializer = env.container.lookup("serializer:homePlanet");

  var json_hash = {
    home_planets: [{
      id: "1",
      name: "Umber",
      villains: [{
        id: "1",
        first_name: "Tom",
        last_name: "Dale"
      }]
    }]
  };

  var array = serializer.extractArray(env.store, HomePlanet, json_hash);

  deepEqual(array, [{
    id: "1",
    name: "Umber",
    villains: ["1"]
  }]);

  env.store.find("superVillain", 1).then(async(function(minion){
    equal(minion.get('firstName'), "Tom");
  }));
});

test("extractArray with embedded objects of same type as primary type", function() {
  env.container.register('adapter:comment', DS.DjangoTastypieAdapter);
  env.container.register('serializer:comment', DS.DjangoTastypieSerializer.extend({
    attrs: {
      children: {embedded: 'always'}
    }
  }));

  var serializer = env.container.lookup("serializer:comment");

  var json_hash = {
    objects: [{
      id: "1",
      body: "Hello",
      root: true,
      children: [{
        id: "2",
        body: "World",
        root: false
      },
      {
        id: "3",
        body: "Foo",
        root: false
      }]
    }]
  };

  var array = serializer.extractArray(env.store, Comment, json_hash);

  deepEqual(array, [{
    id: "1",
    body: "Hello",
    root: true,
    children: ["2", "3"]
  }], "Primary array is correct");

  equal(env.store.recordForId("comment", "2").get("body"), "World", "Secondary record found in the store");
  equal(env.store.recordForId("comment", "3").get("body"), "Foo", "Secondary record found in the store");
});

test("extractArray with embedded objects of same type, but from separate attributes", function() {
  env.container.register('adapter:course', DS.DjangoTastypieAdapter);
  env.container.register('serializer:course', DS.DjangoTastypieSerializer.extend({
    attrs: {
      prerequisiteUnits: {embedded: 'always'},
      units: {embedded: 'always'}
    }
  }));

  var serializer = env.container.lookup("serializer:course");
  var json_hash = {
    objects: [{
      id: "1",
      name: "Course 1",
      prerequisiteUnits: [{
        id: "1",
        name: "Unit 1"
      },{
        id: "3",
        name: "Unit 3"
      }],
      units: [{
        id: "2",
        name: "Unit 2"
      },{
        id: "4",
        name: "Unit 4"
      }]
    },{
      id: "2",
      name: "Course 2",
      prerequisiteUnits: [{
        id: "1",
        name: "Unit 1"
      },{
        id: "3",
        name: "Unit 3"
      }],
      units: [{
        id: "5",
        name: "Unit 5"
      },{
        id: "6",
        name: "Unit 6"
      }]
    }]
  };
  var json = serializer.extractArray(env.store, Course, json_hash);

  deepEqual(json, [{
    id: "1",
    name: "Course 1",
    prerequisiteUnits: ["1", "3"],
    units: ["2", "4"]
  },{
    id: "2",
    name: "Course 2",
    prerequisiteUnits: ["1", "3"],
    units: ["5", "6"]
  }], "Primary array was correct");

  equal(env.store.recordForId("unit", "1").get("name"), "Unit 1", "Secondary records found in the store");
  equal(env.store.recordForId("unit", "2").get("name"), "Unit 2", "Secondary records found in the store");
  equal(env.store.recordForId("unit", "3").get("name"), "Unit 3", "Secondary records found in the store");
  equal(env.store.recordForId("unit", "4").get("name"), "Unit 4", "Secondary records found in the store");
  equal(env.store.recordForId("unit", "5").get("name"), "Unit 5", "Secondary records found in the store");
  equal(env.store.recordForId("unit", "6").get("name"), "Unit 6", "Secondary records found in the store");
});

test("serialize polymorphic", function() {
  var tom = env.store.createRecord(YellowMinion,   {name: "Alex", id: "124"});
  var ray = env.store.createRecord(DoomsdayDevice, {evilMinion: tom, name: "DeathRay"});

  var json = env.dtSerializer.serialize(ray);

  deepEqual(json, {
    name:  "DeathRay",
    evilMinionType: "yellowMinion",
    evilMinion: "124"
  });
});

test("serialize with embedded objects", function() {
  league = env.store.createRecord(HomePlanet, { name: "Villain League", id: "123" });
  var tom = env.store.createRecord(SuperVillain, { firstName: "Tom", lastName: "Dale", homePlanet: league });

  env.container.register('serializer:homePlanet', DS.DjangoTastypieSerializer.extend({
    attrs: {
      villains: {embedded: 'always'}
    }
  }));
  var serializer = env.container.lookup("serializer:homePlanet");

  var json = serializer.serialize(league);

  deepEqual(json, {
    name: "Villain League",
    villains: [{
      id: get(tom, "id"),
      firstName: "Tom",
      lastName: "Dale",
      homePlanet_id: '/api/v1/homePlanet/' + get(league, "id") +'/',
      evilMinions: []
    }]
  });
});

test("extractPolymorphic hasMany", function() {
  env.container.register('adapter:yellowMinion', DS.DjangoTastypieAdapter);
  PopularVillain.toString = function() { return "PopularVillain"; };
  YellowMinion.toString = function() { return "YellowMinion"; };

  var json_hash = {
    popularVillain: {id: 1, name: "Dr Horrible", evilMinions: [{ type: "yellowMinion", id: 12}] },
    evilMinions:    [{id: 12, name: "Alex", doomsdayDeviceIds: [1] }]
  };

  var json = env.dtSerializer.extractSingle(env.store, PopularVillain, json_hash);

  deepEqual(json, {
    "id": 1,
    "name": "Dr Horrible",
    "evilMinions": [{
      type: "yellowMinion",
      id: 12
    }]
  });
});

test("extractPolymorphic", function() {
  env.container.register('adapter:yellowMinion', DS.DjangoTastypieAdapter);
  EvilMinion.toString   = function() { return "EvilMinion"; };
  YellowMinion.toString = function() { return "YellowMinion"; };

  var json_hash = {
    id: 1, name: "DeathRay", evilMinion: { type: "yellowMinion", id: 12}
  };

  var json = env.dtSerializer.extractSingle(env.store, DoomsdayDevice, json_hash);

  deepEqual(json, {
    "id": 1,
    "name": "DeathRay",
    "evilMinion": {
      type: "yellowMinion",
      id: 12
    }
  });
});

test("extractPolymorphic when the related data is not specified", function() {
  var json = {
    id: 1, name: "DeathRay"
  };

  json = env.dtSerializer.extractSingle(env.store, DoomsdayDevice, json);

  deepEqual(json, {
    "id": 1,
    "name": "DeathRay",
    "evilMinion": undefined
  });
});

test("extractPolymorphic hasMany when the related data is not specified", function() {
  var json = {
    id: 1, name: "Dr Horrible"
  };

  json = env.dtSerializer.extractSingle(env.store, PopularVillain, json);

  deepEqual(json, {
    "id": 1,
    "name": "Dr Horrible",
    "evilMinions": []
  });
});

test("extractPolymorphic does not break hasMany relationships", function() {
  var json = {
    id: 1, name: "Dr. Evil", evilMinions: []
  };

  json = env.dtSerializer.extractSingle(env.store, PopularVillain, json);

  deepEqual(json, {
    "id": 1,
    "name": "Dr. Evil",
    "evilMinions": []
  });
});
