require "bundler/setup"
require "ember-dev/tasks"

require 'pathname'
require 'fileutils'

directory "tmp"

task :docs => "ember:docs"
task :clean => "ember:clean"
task :dist => "ember:dist"
task :test, [:suite] => "ember:test"
task :static, [:suite] => "ember:generate_static_test_site"
task :default => :dist