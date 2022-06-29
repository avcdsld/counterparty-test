require('dotenv').config()
const axios = require('axios').default
const tinysecp = require('tiny-secp256k1')
const { ECPairFactory } = require('ecpair')
const bitcoin = require('bitcoinjs-lib')

const ECPair = ECPairFactory(tinysecp)
const validator = (pubkey, msghash, signature) => ECPair.fromPublicKey(pubkey).verify(msghash, signature)

async function signTx(wif, txHex) {
    const network = bitcoin.networks.testnet
    const keyPair = ECPair.fromWIF(wif, network)
    const dataTx = bitcoin.Transaction.fromHex(txHex)

    const psbt = new bitcoin.Psbt({ network })
    await Promise.all(dataTx.ins.map(async input => {
        const txid = Buffer.from(input.hash).reverse().toString('hex')
        const tx = await axios.get(`https://api.blockcypher.com/v1/btc/test3/txs/${txid}?includeHex=true`)
        psbt.addInput({
            hash: input.hash,
            index: dataTx.ins[0].index,
            script: dataTx.ins[0].script,
            value: dataTx.ins[0].value,
            nonWitnessUtxo: Buffer.from(tx.data.hex, 'hex'),
        })
    }))
    dataTx.outs.map(output => {
        psbt.addOutput({
            script: output.script,
            value: output.value,
        })
    })
    psbt.signInput(0, keyPair)
    psbt.validateSignaturesOfInput(0, validator)
    psbt.finalizeAllInputs()
    return psbt.extractTransaction().toHex()
}

const wif = process.env.PRIVATE_KEY
const txHex = '0100000001dc755fe8fe6e6d2f8c67ac30f7df624fd149ba40138f331db7ad75902c8e8a20010000001976a914fe4d03b8d575e6883e5ea8e1b8e4204cd5e8820588acffffffff020000000000000000396a374419b7bcdd44ca6ed92d44ab1c51812e53c349ec51c43735e7ad3d3ffecca999bcd8d842fb4f5dfa0e6996b030c6d38e626b6305b7585a04301800000000001976a914fe4d03b8d575e6883e5ea8e1b8e4204cd5e8820588ac00000000'
signTx(wif, txHex).then(async (res) => {
    console.log('res', res)

    // You can broadcast signed tx by using the following ways:
    //   - https://blockstream.info/testnet/tx/push
    //   - https://live.blockcypher.com/btc/pushtx/
    //   - https://github.com/bitcoinjs/bitcoinjs-lib/issues/839
})
