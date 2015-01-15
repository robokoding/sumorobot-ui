#!/usr/bin/env ruby

require 'bundler'
Bundler.setup

require 'eventmachine'
require 'em-websocket'
require 'thin'
require 'rack'
require 'json'

$current_cmd = nil

t1 = Thread.new do
  EM.run {
    EM::WebSocket.run(:host => "0.0.0.0", :port => 8899) do |ws|
      ws.onopen { |handshake|
        puts "WebSocket connection open"
      }

      ws.onclose { puts "Connection closed" }

      ws.onmessage { |msg|
        parsed = JSON.parse(msg)
        p parsed
        puts "Recieved message: #{msg}"
        if parsed['cmd'] && ['ping', 'pause', 'resume', 'stop', 'version', 'beep'].include?(parsed['cmd'])
          response = {'status' => 'complete'}
          response['id'] = parsed['id'] if parsed['id']
          response['msg'] = '20140629' if parsed['cmd'] == 'version'
          ws.send JSON.generate(response)
          $current_cmd = nil;
        elsif $current_cmd.nil?
          if parsed['cmd'] && ['forward', 'back', 'right', 'left', 'ping', 'sensors', 'follow'].include?(parsed['cmd'])
            $current_cmd = parsed
            response = {'status' => 'accepted'}
            response['id'] = parsed['id'] if parsed['id']
            ws.send JSON.generate(response)
            if ['ping'].include?(parsed['cmd'])
              delay = 0
            else
              if parsed['arg']
                delay = parsed['arg'].to_i / 20
              end
            end
            EM.add_timer(delay) do
              response = {'status' => 'complete'}
              response['id'] = $current_cmd['id'] if $current_cmd['id']
              ws.send JSON.generate(response)
              $current_cmd = nil
            end
          else
            response = {'status' => 'error', 'msg' => "Command not recognised"}
            response['id'] = parsed['id'] if parsed['id']
            ws.send JSON.generate(response)
          end
        else
          response = {'status' => 'error', 'msg' => "Previous command not finished"}
          response['id'] = parsed['id'] if parsed['id']
          ws.send JSON.generate(response)
        end
      }
    end
  }
end

t2 = Thread.new do
  Thin::Server.start('0.0.0.0', 3000, :signals => false) do |app|
    use Rack::CommonLogger
    map "/" do
      run Rack::Static.new(app, :root => './src', :index => 'index_en.html', :urls => ['/'])
    end
  end
end

# hit Control + C to stop
Signal.trap("INT")  { EventMachine.stop }
Signal.trap("TERM") { EventMachine.stop }

puts "Servers booted"

t1.join
t2.join

puts "Servers shut down"
