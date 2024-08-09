import { db, admin } from "../DB/firestore.js"
import slugify from "slugify"
import dotenv from "dotenv"
dotenv.config()

//unchecked
async function check_stock(pid, qauntity, size, unformat_color) {
    console.log("inside check stock helper", pid, qauntity, size, unformat_color)
    try {
        const color = slugify(unformat_color)

        const doc = await db.collection(process.env.collectionProduct).doc(pid).collection(process.env.collectioncolor).doc(pid + color).get()
        const act_data = doc.data()

        let check = true
        const size_arr = act_data.sizes
        for (var i = 0; i < size_arr.length; i++) {
            if (size_arr[i].size == size) {
                if (size_arr[i].stock < qauntity) {
                    check = false
                }
                break
            }
        }
        console.log(check)
        return check
    }
    catch (err) {
        console.error(err)
    }
}

export {check_stock}