//! Minimal smart wallet for testnet demos: one ed25519 owner key, no policies.
//! Not for real funds.
#![no_std]
use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype,
    crypto::Hash,
    BytesN, Env, Vec,
};

#[contract]
pub struct TestWallet;

#[contracttype]
enum DataKey {
    Owner,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NoOwner = 1,
}

#[contractimpl]
impl TestWallet {
    pub fn __constructor(env: Env, owner: BytesN<32>) {
        env.storage().instance().set(&DataKey::Owner, &owner);
    }
}

#[contractimpl]
impl CustomAccountInterface for TestWallet {
    type Signature = BytesN<64>;
    type Error = Error;

    #[allow(non_snake_case)]
    fn __check_auth(
        env: Env,
        signature_payload: Hash<32>,
        signature: BytesN<64>,
        _auth_contexts: Vec<Context>,
    ) -> Result<(), Error> {
        let owner: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::Owner)
            .ok_or(Error::NoOwner)?;
        env.crypto()
            .ed25519_verify(&owner, &signature_payload.into(), &signature);
        Ok(())
    }
}
