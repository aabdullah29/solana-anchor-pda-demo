import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SolanaAnchorPda } from "../target/types/solana_anchor_pda";

function shortKey(key: anchor.web3.PublicKey) {
  return key.toString().substring(0, 8);
}

describe("solana-anchor-pda", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SolanaAnchorPda as Program<SolanaAnchorPda>;

  // create new keypair and airdrop 2 sol
  async function generateKeypair() {
    let keypair = anchor.web3.Keypair.generate();
    await provider.connection.requestAirdrop(
      keypair.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await new Promise((resolve) => setTimeout(resolve, 3 * 1000)); // Sleep 3s
    return keypair;
  }

  //generate PDA keypair
  async function derivePda(color: string, pubkey: anchor.web3.PublicKey) {
    let [pda, _] = await anchor.web3.PublicKey.findProgramAddress(
      [pubkey.toBuffer(), Buffer.from("_"), Buffer.from(color)],
      program.programId
    );
    return pda;
  }

  // call onvhain program methor "create_ledger"
  async function createLedgerAccount(color: string, pda: anchor.web3.PublicKey, wallet: anchor.web3.Keypair) {
    await program.methods.createLedger(color)
      .accounts({
        ledgerAccount: pda,
        wallet: wallet.publicKey,
      })
      .signers([wallet])
      .rpc();
  }

  // call onvhain program methor "modify_ledger"
  async function modifyLedger(color: string, newBalance: number, wallet: anchor.web3.Keypair) {
    console.log("--------------------------------------------------");
    let data;
    let pda = await derivePda(color, wallet.publicKey);

    console.log(`Checking if account ${shortKey(pda)} exists for color: ${color}...`);
    try {
      data = await program.account.ledger.fetch(pda);
      console.log("It does.");
    } catch (e) {
      console.log("It does NOT. Creating...");
      await createLedgerAccount(color, pda, wallet);
      data = await program.account.ledger.fetch(pda);
    }

    console.log("Success.");
    console.log("Data:");
    console.log(`    Color: ${data.color}   Balance: ${data.balance}`);
    console.log(`Modifying balance of ${data.color} from ${data.balance} to ${newBalance}`);

    //call onchain method
    await program.methods.modifyLedger(newBalance)
      .accounts({
        ledgerAccount: pda,
        wallet: wallet.publicKey,
      })
      .signers([wallet])
      .rpc();

    data = await program.account.ledger.fetch(pda);
    console.log("New Data:");
    console.log(`    Color: ${data.color}   Balance: ${data.balance}`);
    console.log("Success.");
  }


  it("An example of PDAs in action", async () => {

    const testKeypair1 = await generateKeypair();
    await modifyLedger("red", 2, testKeypair1);
    await modifyLedger("red", 4, testKeypair1);
    await modifyLedger("blue", 2, testKeypair1);

    const testKeypair2 = await generateKeypair();
    await modifyLedger("red", 3, testKeypair2);
    await modifyLedger("green", 3, testKeypair2);
  });

});
