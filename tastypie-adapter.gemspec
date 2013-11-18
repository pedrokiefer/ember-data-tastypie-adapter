# -*- encoding: utf-8 -*-

Gem::Specification.new do |gem|
  gem.name          = "tastypie-adapter"
  gem.authors       = ["Diego Muñoz Escalante", "Pedro Kiefer"]
  gem.email         = ["pedro@kiefer.com.br"]
  gem.date          = Time.now.strftime("%Y-%m-%d")
  gem.summary       = %q{tastypie adapter for ember-data.}
  gem.description   = %q{tastypie adapter for ember-data.}
  gem.homepage      = "https://github.com/pedrokiefer/ember-data-tastypie-adapter"
  gem.version       = "0.1.0"

  gem.add_dependency "ember-source"
  gem.add_dependency "ember-data-source"

  gem.files = Dir['dist/tastypie-adapter*.js']
end
