var get = Ember.get, set = Ember.set;

var env, store, adapter;
var originalAjax, passedUrl, passedVerb, passedHash;
var Person, person, people, Role, Group, group, Task, task;

module("Django Tastypie Adapter", {
  setup: function() {
    Person = DS.Model.extend({
      name: DS.attr('string'),
      tasks: DS.hasMany('task')
    });

    Group = DS.Model.extend({
      name: DS.attr('string'),
      people: DS.hasMany('person')
    });

    Role = DS.Model.extend({
      name: DS.attr('string'),
      primaryKey: '_id'
    });

    Task = DS.Model.extend({
      name: DS.attr('string'),
      owner: DS.belongsTo('person')
    });
    
    env = setupStore({
      person: Person,
      group: Group,
      role: Role,
      task: Task,
      adapter: DS.DjangoTastypieAdapter
    });
    
    store = env.store;
    adapter = env.adapter;
    
    env.store.modelFor('person');
    env.store.modelFor('group');
    env.store.modelFor('role');
    env.store.modelFor('task');
    
    passedUrl = passedVerb = passedHash = null;
  }
});

function ajaxResponse(value) {
  adapter.ajax = function(url, verb, hash) {
    passedUrl = url;
    passedVerb = verb;
    passedHash = hash;

    return Ember.RSVP.resolve(value);
  };
}

var expectUrl = function(url, desc) {
  equal(passedUrl, url, "the URL is " + desc);
};

var expectType = function(type) {
  equal(passedVerb, type, "the HTTP method is " + type);
};

var expectData = function(hash) {
  deepEqual(hash, passedHash.data, "the hash was passed along");
};

var expectState = function(state, value, p) {
  p = p || person;

  if (value === undefined) { value = true; }

  var flag = "is" + state.charAt(0).toUpperCase() + state.substr(1);
  equal(get(p, flag), value, "the person is " + (value === false ? "not " : "") + state);
};

var expectStates = function(state, value) {
  people.forEach(function(person) {
    expectState(state, value, person);
  });
};

test("can create a record", function() {
    var record = store.createRecord('person');
    set(record, 'name', 'bar');

    equal(get(record, 'name'), 'bar', "property was set on the record");
});

test('buildURL - should not use plurals', function() {
  equal(adapter.buildURL('person', 1), "/api/v1/person/1/");
});

test("find - basic payload", function() {

  ajaxResponse({ id: 1, name: "Rails is omakase" });
  
  store.find('person', 1).then(async(function(person) {
    equal(passedUrl, "/api/v1/person/1/");
    equal(passedVerb, "GET");
    equal(passedHash, undefined);

    equal(person.get('id'), "1");
    equal(person.get('name'), "Rails is omakase");
  }));
});

test("creating a person makes a POST to /person, with the data hash", function() {
  ajaxResponse({ objects: [{ id: "1", name: "Tom Dale", tasks: [] }] });
  var person = store.createRecord('person', { name: "Tom Dale" });

  person.save().then(async(function(person) {
    equal(passedUrl, "/api/v1/person/");
    equal(passedVerb, "POST");
    deepEqual(passedHash.data, { name: "Tom Dale", tasks: [] });

    equal(person.get('id'), "1", "the post has the updated ID");
    equal(person.get('isDirty'), false, "the post isn't dirty anymore");
    equal(person.get('name'), "Dat Parley Letter", "the post was updated");    
  }));
  
});

test("updating a person makes a PUT to /people/:id with the data hash", function() {
  set(adapter, 'bulkCommit', false);

  store.push('person', { id: 1, name: "Yehuda Katz" });

  store.find('person', 1).then(async(function(person) {
    set(person, 'name', "Brohuda Brokatz");
    person.save().then(async(function() {
      equal(1,1);
    }));
  }));
  
});

test("updates are not required to return data", function() {
  Ember.run(function() {
    set(adapter, 'bulkCommit', false);

    store.push('person', { id: 1, name: "Yehuda Katz" });

    person = store.find(Person, 1);
  });

  expectState('new', false);
  expectState('loaded');
  expectState('dirty', false);

  Ember.run(function() {
    set(person, 'name', "Brohuda Brokatz");
  });

  expectState('dirty');

  Ember.run(function() {
    store.commit();
  });

  expectState('saving');

  expectUrl("/api/v1/person/1/", "the plural of the model name with its ID");
  expectType("PUT");

  ajaxHash.success();
  expectState('saving', false);

  equal(person, store.find(Person, 1), "the same person is retrieved by the same ID");
  equal(get(person, 'name'), "Brohuda Brokatz", "the data is preserved");
});

/* COMMENTED IN EMBER DATA
test("updating a record with custom primaryKey", function() {
  Ember.run(function() {
    set(adapter, 'bulkCommit', false);
    store.load(Role, { _id: 1, name: "Developer" });

    role = store.find(Role, 1);

    set(role, 'name', "Manager");
    store.commit();
  });

  expectUrl("api/v1/role/1/", "the plural of the model name with its ID");
  ajaxHash.success({ role: { _id: 1, name: "Manager" } });
});*/


test("deleting a person makes a DELETE to /people/:id", function() {
  Ember.run(function() {
    set(adapter, 'bulkCommit', false);

    store.push('person', { id: 1, name: "Tom Dale" });

    person = store.find(Person, 1);
  });

  expectState('new', false);
  expectState('loaded');
  expectState('dirty', false);

  Ember.run(function() {
    person.deleteRecord();
  });

  expectState('dirty');
  expectState('deleted');

  Ember.run(function() {
    store.commit();
  });

  expectState('saving');

  expectUrl("/api/v1/person/1/", "the plural of the model name with its ID");
  expectType("DELETE");

  ajaxHash.success();
  expectState('deleted');
});

/* COMMENTED IN EMBER DATA
test("deleting a record with custom primaryKey", function() {
  Ember.run(function() {
    set(adapter, 'bulkCommit', false);

    store.load(Role, { _id: 1, name: "Developer" });

    role = store.find(Role, 1);

    role.deleteRecord();

    store.commit();
  });

  expectUrl("api/v1/role/1/", "the plural of the model name with its ID");
  ajaxHash.success();
});*/

test("finding all people makes a GET to api/v1/person/", function() {
  
  
  store.find('person').then(async(function(people) {
    
  }));

  expectUrl("/api/v1/person/", "the plural of the model name");

  expectType("GET");

  ajaxHash.success({"objects": [{ id: 1, name: "Yehuda Katz" }]});

  person = people.objectAt(0);

  expectState('loaded');
  expectState('dirty', false);

  equal(person, store.find(Person, 1), "the record is now in the store, and can be looked up by ID without another Ajax request");
});

test("since gets set if needed for pagination", function() {
  Ember.run(function() {
    people = store.find('person');
  });

  expectUrl("/api/v1/person/", "the findAll URL");
  ajaxHash.success({"objects": [{id: 1, name: "Roy"}, {id: 2, name: "Moss"}],
            "meta": {limit: 2, next: "nextUrl&offset=2", offset: 0, previous: null, total_count: 25}});

  Ember.run(function() {
    morePeople = store.find(Person);
  });
  expectData({offset: '2'});
  expectUrl("/api/v1/person/", "the findAll URL is the same with the since parameter");
});

test("finding a person by ID makes a GET to api/v1/person/:id", function() {
  Ember.run(function() {
    person = store.find('person', 1);
  });

  expectState('loaded', false);
  expectUrl("/api/v1/person/1/", "the plural of the model name with the ID requested");
  expectType("GET");

  ajaxHash.success({ id: 1, name: "Yehuda Katz" });

  expectState('loaded');
  expectState('dirty', false);

  equal(person, store.find(Person, 1), "the record is now in the store, and can be looked up by ID without another Ajax request");
});

test("findMany generates a tastypie style url", function() {
  var adapter = store.get('adapter');

  Ember.run(function() {
    adapter.findMany(store, 'person', [1,2,3]).then(async(function(person) {
      expectUrl("/api/v1/person/set/1;2;3/");
      expectType("GET"); 
    }));
  });
});

test("finding many people by a list of IDs", function() {
  var group;

  Ember.run(function() {
    store.load('group', { id: 1, people: [
      "/api/v1/person/1/",
      "/api/v1/person/2/",
      "/api/v1/person/3/"
    ]});

    group = store.find(Group, 1);
  });

  equal(ajaxUrl, undefined, "no Ajax calls have been made yet");

  var people = get(group, 'people');

  equal(get(people, 'length'), 3, "there are three people in the association already");

  people.forEach(function(person) {
    equal(get(person, 'isLoaded'), false, "the person is being loaded");
  });

  expectUrl("/api/v1/person/set/1;2;3/");
  expectType("GET");

  ajaxHash.success({"objects":
    [
      { id: 1, name: "Rein Heinrichs" },
      { id: 2, name: "Tom Dale" },
      { id: 3, name: "Yehuda Katz" }
    ]}
  );

  var rein = people.objectAt(0);
  equal(get(rein, 'name'), "Rein Heinrichs");
  equal(get(rein, 'id'), 1);

  var tom = people.objectAt(1);
  equal(get(tom, 'name'), "Tom Dale");
  equal(get(tom, 'id'), 2);

  var yehuda = people.objectAt(2);
  equal(get(yehuda, 'name'), "Yehuda Katz");
  equal(get(yehuda, 'id'), 3);

  people.forEach(function(person) {
    equal(get(person, 'isLoaded'), true, "the person is being loaded");
  });
});

test("finding people by a query", function() {
  var people, rein, tom, yehuda;
  
  ajaxResponse({
    objects: [
      { id: 1, name: "Rein Heinrichs" },
      { id: 2, name: "Tom Dale" },
      { id: 3, name: "Yehuda Katz" }
    ]
  });
  
  store.find('person', {page: 1}).then(async(function(people) {
    equal(passedUrl, "/api/v1/person/");
    equal(passedVerb, "GET");
    deepEqual(passedHash, { page: 1 });
    
    equal(get(people, 'length'), 3, "the people are now loaded");

    equal(person.get('id'), "1");
    equal(person.get('name'), "Rails is omakase");
    
    rein = people.objectAt(0);
    equal(get(rein, 'name'), "Rein Heinrichs");
    equal(get(rein, 'id'), 1);
    
    tom = people.objectAt(1);
    equal(get(tom, 'name'), "Tom Dale");
    equal(get(tom, 'id'), 2);
    
    yehuda = people.objectAt(2);
    equal(get(yehuda, 'name'), "Yehuda Katz");
    equal(get(yehuda, 'id'), 3);
    
    people.forEach(function(person) {
      equal(get(person, 'isLoaded'), true, "the person is being loaded");
    });
    
  }));
});

test("if you specify a server domain then it is prepended onto all URLs", function() {
  Ember.run(function() {
    set(adapter, 'serverDomain', 'http://localhost:8000/');
    equal(adapter.buildURL('person', 1), "http://localhost:8000/api/v1/person/1/");
  });
});

test("the adapter can use custom keys", function() {
  Person = DS.Model.extend({
    name: DS.attr('string')
  });

  var Adapter = DS.DjangoTastypieAdapter.extend();
  Adapter.map('Person', {
    name: {key: 'name_custom'}
  });

  var adapter = Adapter;
  var person;
  Ember.run(function() {
    person = Person.createRecord({name: "Maurice Moss"});
  });

  equal(JSON.stringify(adapter.serialize(person)), '{"name_custom":"Maurice Moss"}');
});

test("creating an item with a belongsTo relationship urlifies the Resource URI (default key)", function() {
  Ember.run(function() {
    store.load('person', {id: 1, name: "Maurice Moss"});
    person = store.find(Person, 1);
  });

  expectState('new', false);
  expectState('loaded');
  expectState('dirty', false);

  Ember.run(function() {
    task = Task.createRecord({name: "Get a bike!"});
  });

  expectState('new', true, task);
  expectState('dirty', true, task);

  Ember.run(function() {
    set(task, 'owner', person);

    store.commit();
  });

  expectUrl('/api/v1/task/', 'create URL');
  expectType("POST");
  expectData({ name: "Get a bike!", owner_id: "/api/v1/person/1/"});

  ajaxHash.success({ id: 1, name: "Get a bike!", owner: "/api/v1/person/1/"}, Task);

});

test("creating an item with a belongsTo relationship urlifies the Resource URI (custom key)", function() {

  var Adapter, task, adapter;

  Ember.run(function() {
    DS.DjangoTastypieAdapter.map('Task', {
      owner: {key: 'owner_custom_key'}
    });

    store.set('adapter', DS.DjangoTastypieAdapter);

    store.load(Person, {id: 1, name: "Maurice Moss"});
    person = store.find(Person, 1);

    task = Task.createRecord({name: "Get a bike!"});

    task.set('owner', person);
  });

  expectState('new', true, task);
  expectState('dirty', true, task);

  Ember.run(function() {
    store.commit();
  });

  expectUrl('/api/v1/task/', 'create URL');
  expectType("POST");
  expectData({ name: "Get a bike!", owner_custom_key: "/api/v1/person/1/"});

  ajaxHash.success({ id: 1, name: "Get a bike!", owner: "/api/v1/person/1/"}, Task);

  expectState('new', false, task);
  expectState('dirty', false, task);
});

test("adding hasMany relationships parses the Resource URI (default key)", function() {

  Person = DS.Model.extend({
    name: DS.attr('string'),
    group: DS.belongsTo('Group')
  });
  Person.toString = function() {
    return "Person";
  };

  equal(true, true);
  store.push(Person, {id: 1, name: "Maurice Moss"});
  store.push(Person, {id: 2, name: "Roy"});
  store.push(Group, {id: 1, name: "Team"});

  var moss = store.find(Person, 1);
  var roy = store.find(Person, 2);

  group = store.find(Group, 1);
  get(group, 'people').pushObject(moss);
  get(group, 'people').pushObject(roy);

  Ember.run(store, store.commit);

  // HasMany updates through the belongsTo component
  expectUrl('/api/v1/person/2/', 'modify Group URL');
  expectType("PUT");
  expectData({name: "Roy", group_id: '/api/v1/group/1/' });

});

test("can load embedded hasMany records", function() {

  var Adapter;

  Adapter = DS.DjangoTastypieAdapter.extend({});

  Adapter.map('Person', {
    tasks: {embedded: 'load'}
  });

  store.set('adapter', Adapter);


  var data = {
    "id": 1,
    "name": "Maurice Moss",
    "tasks": [{
      "name": "Learn German Kitchen",
      "id": "1",
      "resource_uri": "\/api\/v1\/task\/1\/"
    },
    {
      "name": "Join Friendface",
      "id": "2",
      "resource_uri": "\/api\/v1\/task\/2\/"
    }],
    "resource_uri": "\/api\/v1\/person\/1\/"
  };

  adapter.didFindRecord(store, Person, data);

  var moss = store.find(Person, 1);
  var german = store.find(Task, 1);
  var friendface = store.find(Task, 2);
  equal("Maurice Moss", moss.get('name'));
  equal("Learn German Kitchen", german.get('name'));
  equal("Join Friendface", friendface.get('name'));
  equal(2, moss.get('tasks.length'));
});


test("can load embedded belongTo records", function() {

  var Adapter;

  Adapter = DS.DjangoTastypieAdapter.extend({});

  Adapter.map('Task', {
    owner: {embedded: 'load', key: 'owner'}
  });

  store.set('adapter', Adapter);


  var data = {
    "id": 1,
    "name": "Get a bike!",
    "owner": {
      "name": "Maurice Moss",
      "id": "1",
      "resource_uri": "\/api\/v1\/person\/1\/"
    },
    "resource_uri": "\/api\/v1\/task\/1\/"
  };

  adapter.didFindRecord(store, Task, data);

  var moss = store.find(Person, 1);
  var bike = store.find(Task, 1);
  equal("Maurice Moss", moss.get('name'));
  equal("Get a bike!", bike.get('name'));
});

test("can load embedded belongTo records in a find response", function() {

  var Adapter,
      recordArray;

  Adapter = DS.DjangoTastypieAdapter.extend({});

  Adapter.map('Task', {
    owner: {embedded: 'load', key: 'owner'}
  });

  store.set('adapter', Adapter);


  var data = {
    "meta": {},
    "objects": [{
      "id": 1,
      "name": "Get a bike!",
      "owner": {
        "name": "Maurice Moss",
        "id": "1",
        "resource_uri": "\/api\/v1\/person\/1\/"
       },
      "resource_uri": "\/api\/v1\/task\/1\/"
    }]
   };

  recordArray = store.findQuery({limit:1});
  adapter.didFindQuery(store, Task, data, recordArray);

  var moss = store.find(Person, 1);
  var bike = store.find(Task, 1);
  equal("Maurice Moss", moss.get('name'));
  equal("Get a bike!", bike.get('name'));
  equal("Maurice Moss", bike.get('owner').get('name'));
});


test("can load embedded hasMany records with camelCased properties", function() {

  var Adapter;

  Adapter = DS.DjangoTastypieAdapter.extend({});

  Person = DS.Model.extend({
    name: DS.attr('string'),
    tasksToDo: DS.hasMany('Task')
  });


  Adapter.map('Person', {
    tasksToDo: {embedded: 'load', key: 'tasksToDo'}
  });

  store.set('adapter', Adapter);

  var data = {
    "id": 1,
    "name": "Maurice Moss",
    "tasksToDo": [{
      "name": "Learn German Kitchen",
      "id": "1",
      "resource_uri": "\/api\/v1\/task\/1\/"
    },
    {
      "name": "Join Friendface",
      "id": "2",
      "resource_uri": "\/api\/v1\/task\/2\/"
    }],
    "resource_uri": "\/api\/v1\/person\/1\/"
  };

  adapter.didFindRecord(store, Person, data);

  var moss = store.find(Person, 1);
  var german = store.find(Task, 1);
  var friendface = store.find(Task, 2);
  equal("Maurice Moss", moss.get('name'));
  equal("Learn German Kitchen", german.get('name'));
  equal("Join Friendface", friendface.get('name'));
});
