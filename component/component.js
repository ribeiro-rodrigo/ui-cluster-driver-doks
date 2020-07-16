/*!!!!!!!!!!!Do not change anything between here (the DRIVERNAME placeholder will be automatically replaced at buildtime)!!!!!!!!!!!*/
// https://github.com/rancher/ui/blob/master/lib/shared/addon/mixins/cluster-driver.js
import ClusterDriver from 'shared/mixins/cluster-driver';
//import AWS from 'aws-sdk'
import $ from 'jquery';
import Semver, { minor, coerce } from 'semver';
import { INSTANCE_TYPES, nameFromResource, tagsFromResource } from 'shared/utils/amazon';
import C from 'shared/utils/constants';
import { satisfies, coerceVersion } from 'shared/utils/parse-version';
// do not remove LAYOUT, it is replaced at build time with a base64 representation of the template of the hbs template
// we do this to avoid converting template to a js file that returns a string and the cors issues that would come along with that
const LAYOUT;
/*!!!!!!!!!!!DO NOT CHANGE END!!!!!!!!!!!*/

/*!!!!!!!!!!!GLOBAL CONST START!!!!!!!!!!!*/
// EMBER API Access - if you need access to any of the Ember API's add them here in the same manner rather then import them via modules, since the dependencies exist in rancher we dont want to expor the modules in the amd def
const computed = Ember.computed;
const observer = Ember.observer;
const get = Ember.get;
const set = Ember.set;
const setProperties = Ember.setProperties;
const alias = Ember.computed.alias;
const service = Ember.inject.service;
const all = Ember.RSVP.all;
const isEmpty = Ember.isEmpty;
const equal = Ember.computed.equal;

const REGIONS = ['us-east-2', 'us-east-1', 'us-west-2', 'ap-east-1', 'ap-south-1', 'ap-northeast-1', 'ap-northeast-2', 'ap-southeast-1', 'ap-southeast-2', 'ca-central-1', 'cn-north-1', 'cn-northwest-1', 'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-north-1', 'me-south-1', 'sa-east-1'];
const RANCHER_GROUP = 'rancher-nodes';
const VERSIONS = ['1.15', '1.14', '1.13']; // sort newest->oldest so we dont have to run any logic to sort like other provider versions

/*!!!!!!!!!!!GLOBAL CONST END!!!!!!!!!!!*/

/*!!!!!!!!!!!DO NOT CHANGE START!!!!!!!!!!!*/
export default Ember.Component.extend(ClusterDriver, {
    intl: service(),
    driverName: '%%DRIVERNAME%%',
    configField: '%%DRIVERNAME%%EngineConfig', // 'googleKubernetesEngineConfig'
    app: service(),
    router: service(),
    /*!!!!!!!!!!!DO NOT CHANGE END!!!!!!!!!!!*/
    versionChoiceService: service('version-choices'),
    settings: service(),
    defaultK8sVersionRange: alias(`settings.${C.SETTING.VERSION_SYSTEM_K8S_DEFAULT_RANGE}`),
    instanceTypes: INSTANCE_TYPES,
    regionChoices: REGIONS,
    step: 1,
    serviceRoles: null,
    securityGroups: null,
    whichSecurityGroup: 'default',
    defaultSecurityGroupName: RANCHER_GROUP,
    errors: [],
    serviceRoleMode: 'default',
    vpcSubnetMode: 'default',
    allSecurityGroups: null,
    allKeyPairs: null,
    selectedServiceRole: null,
    selectedGroupedDetails: null,
    kubernetesVersionContent: VERSIONS,
    isCustomSecurityGroup: equal('whichSecurityGroup', 'custom'),
    editing: equal('mode', 'edit'),
    config: alias('cluster.%%DRIVERNAME%%EngineConfig'),

    parseCloudProviderVersionChoices(versions, providerVersion, mode) {
        let {
            intl,
            defaultK8sVersionRange
        } = this;
        const maxVersionRange = defaultK8sVersionRange.split(' ').pop();

        return versions.map((version) => {
            if (satisfies(coerceVersion(version), maxVersionRange)) {
                const out = {
                    label: version,
                    value: version,
                };

                if (mode === 'edit') {
                    if (Semver.lt(coerceVersion(version), coerceVersion(providerVersion))) {
                        setProperties(out, {
                            disabled: true,
                            label: `${out.label} ${intl.t('formVersions.downgrade')}`
                        });
                    }
                }

                return out;
            }
        });
    },

    init() {
        /*!!!!!!!!!!!DO NOT CHANGE START!!!!!!!!!!!*/
        // This does on the fly template compiling, if you mess with this :cry:
        const decodedLayout = window.atob(LAYOUT);
        const template = Ember.HTMLBars.compile(decodedLayout, {
            moduleName: 'shared/components/cluster-driver/driver-%%DRIVERNAME%%/template'
        });
        set(this, 'layout', template);

        this._super(...arguments);
        /*!!!!!!!!!!!DO NOT CHANGE END!!!!!!!!!!!*/
        console.log(Object.isExtensible(this));
        setProperties(this, {
            clients: {},
            allSubnets: []
        })

        let config = get(this, 'cluster.%%DRIVERNAME%%EngineConfig');
        let configField = get(this, 'configField');

        console.log('antes -- ' + Object.isExtensible(config))

        if (!config) {
            config = this.get('globalStore').createRecord({
                type: configField,
                accessKey: null,
                secretKey: null,
                region: 'us-west-2',
                instanceType: 'm5.large',
                desiredNodes: 1,
                minimumNodes: 1,
                maximumNodes: 1,
                kubernetesVersion: this.kubernetesVersionContent.firstObject,
            });
            console.log('store -- ' + Object.isExtensible(config))

            set(this, 'cluster.%%DRIVERNAME%%EngineConfig', config);
        } else {
            if (this.mode === 'edit') {
                setProperties(this, {
                    vpcSubnetMode: 'custom',
                    serviceRoleMode: 'custom',
                });

                if (get(this, 'cluster.hasSessionToken')) {
                    set(this, 'cluster.%%DRIVERNAME%%EngineConfig.accessKey', null);
                }

                //console.log('indo para o step 6');
                //set(this, 'step', 6);
            }

        }

        console.log('depois -- ' + Object.isExtensible(config))
    },

    willDestroyElement() {
        setProperties(this, {
            step: 1,
            clients: null,
            allSubnets: null,
        });
    },

    config: alias('cluster.%%DRIVERNAME%%EngineConfig'),

    actions: {
        multiSecurityGroupSelect() {
            let options = Array.prototype.slice.call($('.existing-security-groups')[0], 0);
            let selectedOptions = [];

            options.filterBy('selected', true).forEach((cap) => {
                return selectedOptions.push(cap.value);
            });

            set(this, 'cluster.%%DRIVERNAME%%EngineConfig.securityGroups', selectedOptions);
        },
        multiSubnetGroupSelect() {
            let options = Array.prototype.slice.call($('.existing-subnet-groups')[0], 0);
            let selectedOptions = [];

            options.filterBy('selected', true).forEach((cap) => {
                return selectedOptions.push(cap.value);
            });

            set(this, 'cluster.%%DRIVERNAME%%EngineConfig.subnets', selectedOptions);
        },
        awsLogin(cb) {
            this.listRoles(this.authCreds()).then((roles) => {
                let eksRoles = [];

                eksRoles = roles.filter((role) => {
                    //
                    let policy = JSON.parse(decodeURIComponent(get(role, 'AssumeRolePolicyDocument')));
                    let statement = get(policy, 'Statement');
                    let isEksRole = false;

                    statement.forEach((doc) => {
                        let principal = get(doc, 'Principal');

                        if (principal) {
                            let service = get(principal, 'Service');

                            if (service && (service.includes('eks.amazonaws') || service.includes('EKS')) && !eksRoles.findBy('RoleId', get(role, 'RoleId'))) {
                                // console.log(service.includes('eks'), service.includes('EKS'), eksRoles.findBy('RoleId', get(role, 'RoleId')), role)
                                isEksRole = true;
                            } else if (get(principal, 'EKS')) {
                                // console.log(get(principal, 'EKS'), role);
                                isEksRole = true;
                            } else {
                                isEksRole = false;
                            }
                        }
                    });

                    if (isEksRole) {
                        return role;
                    }
                });

                set(this, 'serviceRoles', eksRoles);

                return this.loadKeyPairs(this.authCreds()).then((/* keyPairs */) => {
                    if (this.mode === 'edit') {
                        set(this, 'step', 6);
                    } else {
                        set(this, 'step', 2);
                    }
                    cb();
                }).catch((err) => {
                    //get(this, 'errors').pushObject(err);
                    let errors = get(this, 'errors') || [];
                    errors.pushObject(err);
                    set(this, 'errors', errors);
                    cb(false, err);
                });
            }).catch((err) => {
                //get(this, 'errors').pushObject(err);
                let errors = get(this, 'errors') || [];
                errors.pushObject(err);
                set(this, 'errors', errors);
                cb(false, err);
            });
        },
        loadVPS(cb) {
            if (get(this, 'selectedServiceRole')) {
                set(this, 'cluster.%%DRIVERNAME%%EngineConfig.serviceRole', get(this, 'selectedServiceRole'));
            }

            this.loadVpcs(this.authCreds()).then(() => {
                set(this, 'step', 3);

                cb();
            }).catch((err) => {
                get(this, 'errors').pushObject(err);
                cb(false, err);
            });
        },
        setVPCS(cb) {
            if (get(this, 'vpcSubnetMode') === 'custom') {
                this.loadSubnets(this.authCreds()).then(() => {
                    set(this, 'step', 4);

                    cb();
                }).catch((err) => {
                    get(this, 'errors').pushObject(err);
                    cb(false, err);
                });
            } else {
                set(this, 'step', 6);
            }
        },

        setSubnets(cb) {
            this.loadSecurityGroups(this.authCreds()).then(() => {
                set(this, 'step', 5);

                cb();
            }).catch((err) => {
                get(this, 'errors').pushObject(err);
                cb(false, err);
            });
        },

        save(cb) {
            // temporary measure put in place for rancher/rancher#24652
            console.log('caiu aqui')
            const {
                cluster: {
                    eksEngineConfig: { subnets }
                }
            } = this;

            if (isEmpty(subnets)) {
                set(this, 'cluster.%%DRIVERNAME%%EngineConfig.subnets', []);
            }
            console.log(arguments);
            return this._super(...arguments);
            //console.log('chamando save');
            //this.send('driverSave', cb);
            //console.log('chamou save');
        },
        cancel() {
            // probably should not remove this as its what every other driver uses to get back
            get(this, 'router').transitionTo('global-admin.clusters.index');
        },
    },

    publicIpChanged: observer('step', 'cluster.%%DRIVERNAME%%EngineConfig.associateWorkerNodePublicIp', function () {
        if (!get(this, 'cluster.%%DRIVERNAME%%EngineConfig.associateWorkerNodePublicIp')) {
            set(this, 'vpcSubnetMode', 'custom');
        }
    }),

    desiredNodesChanged: observer('cluster.%%DRIVERNAME%%EngineConfig.desiredNodes', function () {
        const desiredNodes = get(this, 'cluster.%%DRIVERNAME%%EngineConfig.desiredNodes');
        const config = get(this, 'cluster.%%DRIVERNAME%%EngineConfig');

        setProperties(config, {
            minimumNodes: desiredNodes,
            maximumNodes: desiredNodes
        })
    }),

    vpcSubnetModeDidChange: observer('step', 'vpcSubnetMode', function () {
        const {
            vpcSubnetMode: mode,
            editing,
            step,
        } = this;

        if (!editing && mode === 'custom') {
            const vpc = get(this, 'filteredVpcs.firstObject.id');

            if (step <= 3) {
                if (vpc) {
                    set(this, 'cluster.%%DRIVERNAME%%EngineConfig.virtualNetwork', vpc);
                }
            }
        }
    }),

    serviceRoleModeDidChange: observer('serviceRoleMode', function () {
        const mode = get(this, 'serviceRoleMode');

        if (mode === 'custom') {
            const role = get(this, 'serviceRoles.firstObject.RoleName');

            if (role) {
                set(this, 'selectedServiceRole', role);
            }
        } else {
            set(this, 'selectedServiceRole', null);
        }
    }),

    vpcsChanged: observer('cluster.%%DRIVERNAME%%EngineConfig.virtualNetwork', 'vpcSubnetMode', function () {
        if (!this.primaryResource.isTransitioning) {
            const vnet = get(this, 'cluster.%%DRIVERNAME%%EngineConfig.virtualNetwork');
            const subnets = get(this, 'cluster.%%DRIVERNAME%%EngineConfig.subnets');
            const mode = get(this, 'vpcSubnetMode');
            const hasInitializedValues = vnet || subnets;

            if (vnet && mode === 'custom') {
                this.loadSubnets(this.authCreds()).catch((err) => {
                    get(this, 'errors').pushObject(err);
                });
                // We check for initialized values here because as part of
                // the saving process this observer gets triggered with
                // uninitialized values. This was causing a save to switch
                // the step to step 3 rather than remaining on the last
                // page until the saving was complete.
            } else if (mode === 'default' && hasInitializedValues) {
                setProperties(get(this, 'cluster.%%DRIVERNAME%%EngineConfig'), {
                    virtualNetwork: null,
                    subnets: [],
                });

                set(this, 'step', 3);
            }
        }
    }),

    versionChoices: computed('versions', function () {
        const {
            cluster: {
                eksEngineConfig: { kubernetesVersion: initialVersion }
            },
            app,
            kubernetesVersionContent,
            mode,
        } = this;
        //const versionChoices = this.versionChoiceService.parseCloudProviderVersionChoices(kubernetesVersionContent.slice(), initialVersion, mode);
        const versionChoices = this.parseCloudProviderVersionChoices(kubernetesVersionContent.slice(), initialVersion, mode);
        // only EKS and edit - user can only upgrade a single minor version at a time
        if (this.editing) {
            const initalMinorVersion = parseInt(minor(coerce(initialVersion)), 10);

            versionChoices.forEach((vc) => {
                const vcMinorV = parseInt(minor(coerce(vc.value)), 10);
                const diff = vcMinorV - initalMinorVersion;

                if (diff > 1) {
                    setProperties(vc, {
                        disabled: true,
                        label: `${vc.label} ${app.t('formVersions.eks.label')}`,
                    });
                }
            })
        }

        return versionChoices;
    }),

    filteredKeyPairs: computed('allKeyPairs', function () {
        return get(this, 'allKeyPairs').sortBy('KeyName');
    }),

    filteredSubnets: computed('allSubnets', function () {
        return get(this, 'allSubnets').filterBy('VpcId', get(this, 'cluster.%%DRIVERNAME%%EngineConfig.virtualNetwork')).map((subnet) => {
            return {
                subnetName: nameFromResource(subnet, 'SubnetId'),
                subnetId: subnet.SubnetId,
            }
        }).sortBy('subnetName');
    }),

    filteredVpcs: computed('allVpcs', function () {
        return (get(this, 'allVpcs') || []).filterBy('State', 'available').map((vpc) => {
            return {
                id: get(vpc, 'VpcId'),
                label: `${get(vpc, 'VpcId')} (${get(vpc, 'CidrBlock')})`
            };
        }).sortBy('label');
    }),

    filteredSecurityGroups: computed('allSecurityGroups', function () {
        return get(this, 'allSecurityGroups').filterBy('VpcId', get(this, 'cluster.%%DRIVERNAME%%EngineConfig.virtualNetwork')).sortBy('GroupName');
    }),

    readableServiceRole: computed('cluster.%%DRIVERNAME%%EngineConfig.serviceRole', function () {
        const roles = get(this, 'serviceRoles');
        const selectedRole = get(this, 'cluster.%%DRIVERNAME%%EngineConfig.serviceRole');
        const match = roles.findBy('RoleName', selectedRole);

        return match && match.RoleName ? get(match, 'RoleName') : this.app.t('nodeDriver.amazoneks.role.noneSelected');
    }),

    canSaveVPC: computed('vpcSubnetMode', 'selectedGroupedDetails', 'cluster.%%DRIVERNAME%%EngineConfig.virtualNetwork', 'cluster.%%DRIVERNAME%%EngineConfig.subnets.[]', function () {
        const mode = get(this, 'vpcSubnetMode');
        const config = get(this, 'cluster.%%DRIVERNAME%%EngineConfig');
        let disabled = true;

        if (mode === 'default' || get(config, 'virtualNetwork')) {
            disabled = false;
        }

        return disabled;
    }),

    canSaveSG: computed('cluster.%%DRIVERNAME%%EngineConfig.securityGroups.[]', function () {
        const sg = get(this, 'cluster.%%DRIVERNAME%%EngineConfig.securityGroups');

        let disabled = true;

        if (sg && sg.length > 0) {
            disabled = false;
        }

        return disabled;
    }),

    authCreds() {
        const config = get(this, 'cluster.%%DRIVERNAME%%EngineConfig');

        let {
            accessKey, secretKey, region, sessionToken
        } = config;

        console.log(accessKey, secretKey, region, sessionToken)

        accessKey = (accessKey || '').trim();
        secretKey = (secretKey || '').trim();

        setProperties(this, {
            'errors': [],
            'cluster.%%DRIVERNAME%%EngineConfig.accessKey': accessKey,
            'cluster.%%DRIVERNAME%%EngineConfig.secretKey': secretKey,
        });

        const auth = {
            region,
            accessKeyId: accessKey,
            secretAccessKey: secretKey,
        };

        if (sessionToken) {
            let token = sessionToken.trim();

            set(auth, 'sessionToken', token);
            set(this, 'cluster.%%DRIVERNAME%%EngineConfig.sessionToken', token);
        }

        return auth;
    },

    loadVpcs(auth) {
        return this.listVPCs(auth).then((resp) => {
            let { vpcs } = resp;

            let def = vpcs.findBy('IsDefault');

            if (def && def.VpcId) {
                set(this, 'cluster.%%DRIVERNAME%%EngineConfig.virtualNetwork', get(def, 'VpcId'));
            }

            return set(this, 'allVpcs', vpcs);
        });
    },

    loadSubnets(auth) {
        return this.listSubnets(auth).then((resp) => {
            return set(this, 'allSubnets', resp);
        });
    },

    loadSecurityGroups(auth) {
        return this.listSecurityGroups(auth).then((resp) => {
            return set(this, 'allSecurityGroups', resp);
        });
    },

    loadKeyPairs(auth) {
        return this.listKeyPairs(auth).then((resp) => {
            return set(this, 'allKeyPairs', resp);
        });
    },

    listKeyPairs(auth) {
        return new Promise((resolve, reject) => {
            const ec2 = new AWS.EC2(auth);

            ec2.describeKeyPairs({}, (err, data) => {
                if (err) {
                    console.log(err, err.stack);
                    reject(err);
                }

                resolve(data.KeyPairs);
            });
        })
    },

    listRoles(auth) {
        // TODO There is no IAM endpoint in cn-northwest-1 region. We need to use cn-north-1 for now. So users chould be able to create EKS cluster in cn-northwest-1.

        const { region } = auth || {};

        if (region === 'cn-northwest-1') {
            auth.region = 'cn-north-1';
        }

        return new Promise((resolve, reject) => {
            const IAM = new AWS.IAM(auth);

            IAM.listRoles({}, (err, data) => {
                if (err) {
                    console.log(err, err.stack);
                    reject(err);
                }

                resolve(data.Roles);
            });
        });
    },

    listVPCs(auth) {
        return new Promise((resolve, reject) => {
            const ec2 = new AWS.EC2(auth);
            const vpcNames = {};
            const vpcTags = {};

            ec2.describeVpcs({}, (err, vpcs) => {
                if (err) {
                    return reject(err);
                }

                vpcs.Vpcs.forEach((vpc) => {
                    vpcNames[vpc.VpcId] = nameFromResource(vpc, 'VpcId');
                    vpcTags[vpc.VpcId] = tagsFromResource(vpc);
                });

                return resolve({
                    vpcNames,
                    vpcTags,
                    vpcs: vpcs.Vpcs
                });
            });
        });
    },

    listSubnets(auth) {
        const ec2 = new AWS.EC2(auth);
        const rName = get(this, 'cluster.%%DRIVERNAME%%EngineConfig.region');
        let subnets = [];


        return new Promise((resolve, reject) => {
            ec2.describeSubnets({}, (err, data) => {
                if (err) {
                    reject(err)
                }

                set(this, `clients.${rName}`, ec2)

                subnets = data.Subnets;

                resolve(subnets);
            });
        });
    },

    listSecurityGroups(auth) {
        const ec2 = new AWS.EC2(auth);

        return new Promise((resolve, reject) => {
            ec2.describeSecurityGroups({}, (err, data) => {
                if (err) {
                    reject(err)
                }

                resolve(data.SecurityGroups);
            });
        });
    },

    willSave() {
        // temporary measure put in place for rancher/rancher#24652
        console.log('caiu aqui')
        const {
            cluster: {
                eksEngineConfig: { subnets }
            }
        } = this;

        if (isEmpty(subnets)) {
            set(this, 'cluster.%%DRIVERNAME%%EngineConfig.subnets', []);
        }
        console.log(arguments);

        let config = get(this, 'cluster.%%DRIVERNAME%%EngineConfig');
        console.log(config);

        return this._super(...arguments);
        //console.log('chamando save');
        //this.send('driverSave', cb);
        //console.log('chamou save');
    },

    // Add custom validation beyond what can be done from the config API schema
    validate() {
        // Get generic API validation errors
        this._super();
        var errors = get(this, 'errors') || [];
        if (!get(this, 'cluster.name')) {
            errors.push('Name is required');
        }

        // Add more specific errors

        // Check something and add an error entry if it fails:
        // if ( parseInt(get(this, 'config.memorySize'), defaultRadix) < defaultBase ) {
        //   errors.push('Memory Size must be at least 1024 MB');
        // }

        // Set the array of errors for display,
        // and return true if saving should continue.
        if (get(errors, 'length')) {
            set(this, 'errors', errors);
            return false;
        } else {
            set(this, 'errors', null);
            return true;
        }
    },

    // Any computed properties or custom logic can go here
});