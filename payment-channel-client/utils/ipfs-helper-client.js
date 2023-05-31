const configuration = require("../configuration.js")

// IPFS connection parameters
const host = configuration.host;
const port = configuration.port;
const protocol = configuration.protocol;

let ipfsClient;

async function create_ipfs_client() {
    if (!ipfsClient) {
        try {
            const { create } = await import('ipfs-http-client');
            ipfsClient = create({ host, port, protocol });
        } catch (error) {
            console.log(error);
            return Promise.reject(error);
        }
    }

    return ipfsClient;
}

async function get_data_ipfs(cid) {
    try {
        let ipfs = await create_ipfs_client();
        let asyncitr = ipfs.cat(cid);

        for await (const itr of asyncitr) {
            let data = Buffer.from(itr).toString();
            return Promise.resolve(data);
        }
        return Promise.reject(Error("No data found"));
    } catch (error) {
        return Promise.reject(error);
    }
}

async function resolve_cid_ipns(channelid) {
    try {
        const ipfs = await create_ipfs_client();
        const res = await ipfs.key.list();
        const key_result = await res.find((key) => key.name == channelid);

        if (key_result) { // res.result == tru
            let name_res;
            for await (const name of ipfs.name.resolve(key_result.id)) {
                name_res = name;
                break;
            }
            return Promise.resolve(name_res);

        }

        return Promise.reject(Error("No ipns key found"));

    } catch (error) {
        return Promise.reject(error);
    }
}

module.exports = {
    create_ipfs_client,
    get_data_ipfs,
    resolve_cid_ipns
}
