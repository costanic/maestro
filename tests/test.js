const assert = require('assert');

var Config = require('./config.js');
var Commands = require('./commands.js');

let maestro_config = new Config();
let maestro_commands = new Commands();

// Allow 30 seconds for the test to run, and provide 5 seconds for test cleanup
const timeout = 30000;
const timeout_cleanup = 10000;

describe('Maestro Config', function() {

    /**
     * DHCP tests
     **/
    describe('DCHP', function() {

        before(function(done) {
            this.timeout(timeout_cleanup);
            maestro_commands.get_device_id(function(device_id) {
                this.ctx.device_id = device_id;
                this.done();
            }.bind({ctx: this, done: done}));
        });

        afterEach(function(done) {
            this.timeout(timeout_cleanup);
            maestro_commands.run_shell(Commands.list.kill_maestro, function() {
                this.done();
            }.bind({ctx: this, done: done}));
        });

        it('should enable DCHP for eth1 when specified in the configuration file provided to maestro', function(done) {
            this.timeout(timeout);
            maestro_commands.run_shell(Commands.list.ip_flush, null);

            // Create the config
            let view = {
                device_id: this.device_id,
                interfaces: [{interface_name: 'eth1', dhcp: true}]
            };
            let config = maestro_config.render(view);

            maestro_commands.maestro_workflow(config, done, function(data) {
                return data.includes('DHCP') && data.includes('Lease acquired');
            });
        });

        it('should now have a DHCP enabled IP address', function(done) {
            this.timeout(timeout_cleanup);
            maestro_commands.check_ip_addr(1, '172.28.128.', function(contains_ip) {
                assert(contains_ip, 'Interface eth1 not set with an IP address prefixed with 172.28.128.xxx');
                this.done();
            }.bind({ctx: this, done: done}));
        });

        it('should disable DCHP for eth1 when specified in the configuration file provided to maestro', function(done) {
            this.timeout(timeout);
            maestro_commands.run_shell(Commands.list.ip_flush, null);

            // Create the config
            let view = {
                device_id: this.device_id,
                interfaces: [{interface_name: 'eth1', dhcp: false, ip_address: '10.123.123.123', ip_mask: 24}]
            };
            let config = maestro_config.render(view);

            maestro_commands.maestro_workflow(config, done, function(data) {
                return data.includes('Static address set on eth1 of 10.123.123.123');
            });
        });

        it('should now have a static enabled IP address', function(done) {
            this.timeout(timeout_cleanup);
            maestro_commands.check_ip_addr(1, '10.123.123.123', function(contains_ip) {
                assert(contains_ip, 'Interface eth1 not set with IP address 10.123.123.123');
                this.done();
            }.bind({ctx: this, done: done}));
        });

        it('should disable DCHP for eth1 and eth2 when specified in the configuration file provided to maestro', function(done) {
            this.timeout(timeout);
            maestro_commands.run_shell(Commands.list.ip_flush, null);

            // Create the config
            let view = {
                device_id: this.device_id,
                interfaces: [
                    {interface_name: 'eth1', dhcp: false, ip_address: '10.123.123.123', ip_mask: 24},
                    {interface_name: 'eth2', dhcp: false, ip_address: '10.123.123.124', ip_mask: 24}
                ]
            };
            let config = maestro_config.render(view);

            maestro_commands.maestro_workflow(config, done, function(data) {
                return data.includes('Static address set on eth1 of 10.123.123.123') || data.includes('Static address set on eth1 of 10.123.123.124');
            });
        });

        it('should now have 2 static enabled IP addresses', function(done) {
            this.timeout(timeout);
            maestro_commands.check_ip_addr(1, '10.123.123.123', function(contains_ip) {
                assert(contains_ip, 'Interface eth1 not set with IP address 10.123.123.123');
                maestro_commands.check_ip_addr(2, '10.123.123.124', function(contains_ip) {
                    assert(contains_ip, 'Interface eth2 not set with IP address 10.123.123.124');
                    this.done();
                }.bind({ctx: this.ctx, done: this.done}));
            }.bind({ctx: this, done: done}));
        });

        it('should disable DCHP when no networking configuration is specified in the configuration file provided to maestro', function(done) {
            this.timeout(timeout);
            this.skip(); // Currently doesn't support not having a network configuration
            maestro_commands.run_shell(Commands.list.ip_flush, null);
            maestro_commands.maestro_workflow('config_end: true', done, function(data) {
                return data.includes('Static address set on');
            });
        });

        it('should now have a static enabled IP address', function(done) {
            this.timeout(timeout_cleanup);
            this.skip(); // Currently doesn't support not having a network configuration
            maestro_commands.check_ip_addr(1, '10.123.123.123', function(contains_ip) {
                assert(contains_ip, 'Interface eth1 not set with IP address 10.123.123.123');
                this.done();
            }.bind({ctx: this, done: done}));
        });
    });
});

describe('Maestro API', function() {

    /**
     * DHCP tests
     **/
    describe('DCHP', function() {

        before(function(done) {
            this.timeout(timeout);
            maestro_commands.run_shell(Commands.list.ip_flush, null);
            maestro_commands.get_device_id(function(device_id) {
                this.ctx.device_id = device_id;
                assert.notEqual(this.ctx.device_id, '');
                // Create the config
                let view = {
                    device_id: device_id,
                    interfaces: [
                        {interface_name: 'eth1', dhcp: false, ip_address: '10.123.123.123', ip_mask: 24},
                        {interface_name: 'eth2', dhcp: false, ip_address: '10.123.123.124', ip_mask: 24}
                    ]
                };
                let config = maestro_config.render(view);
                maestro_commands.maestro_workflow(config, null, null);
                setTimeout(this.done, 5000);
            }.bind({ctx: this, done: done}));
        });

        after(function(done) {
            this.timeout(timeout_cleanup);
            maestro_commands.run_shell(Commands.list.kill_maestro, function() {
                this.done();
            }.bind({ctx: this, done: done}));
        });

        it('should retrieve the active maestro config', function(done) {
            this.timeout(timeout);
            maestro_commands.run_shell(Commands.list.maestro_shell_get_iface, function(active_iface) {
                let active_config = JSON.parse(active_iface);
                var eth1Array = active_config.filter(function (el) {
                    return el.StoredIfconfig.if_name === 'eth1';
                });
                assert.equal(eth1Array[0].StoredIfconfig.ipv4_addr, '10.123.123.123');
                var eth2Array = active_config.filter(function (el) {
                    return el.StoredIfconfig.if_name === 'eth2';
                });
                assert.equal(eth2Array[0].StoredIfconfig.ipv4_addr, '10.123.123.124');
                this.done();
            }.bind({ctx: this, done: done}));
        });

        it('should change the IP address of the first network adapter', function(done) {
            this.timeout(timeout);

            let interface = 1;
            let view = [{
                dhcpv4: false,
                if_name: "eth" + interface,
                ipv4_addr: "10.234.234.234",
                ipv4_mask: 24,
                clear_addresses: true
            }];
            let json_view = JSON.stringify(view);
            json_view = json_view.replace(/"/g, '\\\"');

            let command = Commands.list.maestro_shell_put_iface;
            command = command.replace('{{payload}}', json_view);

            maestro_commands.run_shell(command, function(result) {
                maestro_commands.check_ip_addr(interface, view[0].ipv4_addr, function(contains_ip) {
                    assert(contains_ip, 'Interface eth' + interface + ' not set with IP address ' + view[0].ipv4_addr);
                    this.done();
                }.bind(this));
            }.bind({ctx: this, done: done}));
        });

        it('should change the IP address of the second network adapter', function(done) {
            this.timeout(timeout);

            let interface = 2;
            let view = [{
                dhcpv4: false,
                if_name: "eth" + interface,
                ipv4_addr: "10.229.229.229",
                ipv4_mask: 24,
                clear_addresses: true
            }];
            let json_view = JSON.stringify(view);
            json_view = json_view.replace(/"/g, '\\\"');

            let command = Commands.list.maestro_shell_put_iface;
            command = command.replace('{{payload}}', json_view);

            maestro_commands.run_shell(command, function(result) {
                maestro_commands.check_ip_addr(interface, view[0].ipv4_addr, function(contains_ip) {
                    assert(contains_ip, 'Interface eth' + interface + ' not set with IP address ' + view[0].ipv4_addr);
                    this.done();
                }.bind(this));
            }.bind({ctx: this, done: done}));
        });

        it('should change the IP address of 2 different network adapters at the same time', function(done) {
            this.timeout(timeout);
            this.skip(); // Currently doesn't support setting two adapters at the same time

            let view = [{
                dhcpv4: false,
                if_name: "eth1",
                ipv4_addr: "10.138.138.138",
                ipv4_mask: 24,
                clear_addresses: true
            },{
                dhcpv4: false,
                if_name: "eth2",
                ipv4_addr: "10.155.155.155",
                ipv4_mask: 24,
                clear_addresses: true
            }];
            let json_view = JSON.stringify(view);
            json_view = json_view.replace(/"/g, '\\\"');

            let command = Commands.list.maestro_shell_put_iface;
            command = command.replace('{{payload}}', json_view);

            maestro_commands.run_shell(command, function(result) {
                maestro_commands.check_ip_addr(1, '10.138.138.138', function(contains_ip) {
                    assert(contains_ip, 'Interface eth1 not set with IP address 10.138.138.138');
                    maestro_commands.check_ip_addr(2, '10.155.155.155', function(contains_ip) {
                        assert(contains_ip, 'Interface eth2 not set with IP address 10.155.155.155');
                        this.done();
                    }.bind(this));
                }.bind(this));
            }.bind({ctx: this, done: done}));
        });

    });
});

function devicedb_set_ip_address(ctx, interface, ip_address)
{
    // Base view but needs to contain ALL of the interfaces
    let body = {
        interfaces: [{
            if_name: "eth1",
        },{
            if_name: "eth2"
        }]
    };
    // Find the interface that we need to modify
    var index = body.interfaces.findIndex(function (el) {
        return el.if_name == this;
    }.bind(interface));
    // Change the specific interface we are interested in
    if (index !== -1) {
        body.interfaces[index] = {
            if_name: interface,
            dhcpv4: false,
            ipv4_addr: ip_address,
            ipv4_mask: 24,
            clear_addresses: true,
            existing: "override"
        };
    }
    // Stringify the view
    let body_string = JSON.stringify(body);
    // Create the master view
    let view = {
        name: "vagrant.{{relay_id}}.MAESTRO_NETWORK_CONFIG_ID",
        relay: "{{relay_id}}",
        body: body_string                
    };
    let json_view = JSON.stringify(view);
    // Formulate the command to send to devicedb
    let command = Commands.list.devicedb_put_iface;
    command = command.replace('{{payload}}', json_view);
    command = command.replace(/{{relay_id}}/g, ctx.device_id);
    command = command.replace(/{{site_id}}/g, ctx.site_id);

    maestro_commands.run_shell(command, function(result) {

        command = Commands.list.devicedb_commit;
        command = command.replace(/{{relay_id}}/g, this.device_id);
        command = command.replace(/{{site_id}}/g, this.site_id);
        maestro_commands.run_shell(command, function(output) {
            setTimeout(function() {
                maestro_commands.check_ip_addr(parseInt(interface.replace('eth', '')), ip_address, function(contains_ip) {
                    assert(contains_ip, 'Interface ' + interface + ' not set with IP address ' + ip_address);
                    this.done();
                }.bind(this));
            }.bind(this), 5000);
        }.bind(this));
    }.bind(ctx));
}

describe('DeviceDB', function() {

    /**
     * DHCP tests
     **/
    describe('DCHP', function() {

        before(function(done) {
            this.timeout(timeout);
            maestro_commands.run_shell(Commands.list.ip_flush, null);

            maestro_commands.get_site_id(function(site_id) {
                this.ctx.site_id = site_id;

                maestro_commands.get_device_id(function(device_id) {
                    this.ctx.device_id = device_id;
                    // Create the config
                    let view = {
                        device_id: device_id,
                        interfaces: [
                            {interface_name: 'eth1', dhcp: false, ip_address: '10.123.123.123', ip_mask: 24},
                            {interface_name: 'eth2', dhcp: false, ip_address: '10.124.124.124', ip_mask: 24}
                        ]
                    };
                    let config = maestro_config.render(view);
                    maestro_commands.maestro_workflow(config, null, null);
                    setTimeout(this.done, 15000);
                }.bind(this));
            }.bind({ctx: this, done: done}));
        });

        after(function(done) {
            this.timeout(timeout_cleanup);
            maestro_commands.run_shell(Commands.list.kill_maestro, function() {
                this.done();
            }.bind({ctx: this, done: done}));
        });

        it('should set the IP address of the first network adapter', function(done) {
            this.timeout(timeout);

            let ctx = {
                device_id: this.device_id,
                site_id: this.site_id,
                done: done,
            }

            devicedb_set_ip_address(ctx, 'eth1', '10.122.122.122');
        });

        it('should change the IP address of the first network adapter', function(done) {
            this.timeout(timeout);

            let ctx = {
                device_id: this.device_id,
                site_id: this.site_id,
                done: done,
            }

            devicedb_set_ip_address(ctx, 'eth1', '10.234.234.234');
        });

        it('should set the IP address of the second network adapter', function(done) {
            this.timeout(timeout);

            let ctx = {
                device_id: this.device_id,
                site_id: this.site_id,
                done: done,
            }

            devicedb_set_ip_address(ctx, 'eth1', '10.125.125.125');
        });

        it('should change the IP address of the second network adapter', function(done) {
            this.timeout(timeout);

            let ctx = {
                device_id: this.device_id,
                site_id: this.site_id,
                done: done,
            }

            devicedb_set_ip_address(ctx, 'eth2', '10.222.222.222');
        });

    });
});

