import { matchData, readAllData, readFieldData, readSingleData, updateData, updateMatchData } from '../DB/crumd.js';
import { admin, db } from '../DB/firestore.js';
import slugify from 'slugify';


export const createCategory = async (req, res) => {
    try {
        const { name } = req.body;
        const categoryId = slugify(name)

        // Request Validation
        if (!name) {
            return res.send({ message: 'Category name is required' });
        }
        if (!categoryId) {
            return res.send({ message: 'Something went wrong' });
        }

        // Check if the tag is already registered
        const querySnapshot = await db
            .collection(process.env.adminCollection)
            .where('slug', '==', categoryId)
            .get();
        if (!querySnapshot.empty) {
            return res.status(200).send({
                success: false,
                message: 'Category already exists.',
            });
        }

        // Prepare category object
        const categoryJson = {
            category: admin.firestore.FieldValue.arrayUnion({
                categoryId: categoryId,
                name: name,
                slug: categoryId,
            }),
        };

        // Add tag details to the database
        await db.collection(process.env.adminCollection).doc('category').update(categoryJson);

        return res.status(201).send({
            success: true,
            message: 'Category Created Successfully',
            category: categoryJson
        });
    } catch (error) {
        console.error('Error in category creation:', error);
        return res.status(500).send({
            success: false,
            message: 'Error in category creation',
            error: error.message,
        });
    }
};


export const readAllCategory = async (req, res) => {
    try {
        var category = await readFieldData(process.env.adminCollection, 'category', 'category');

        return res.status(201).send({
            success: true,
            message: 'All category read successfully',
            category: category
        });
    } catch (error) {
        console.error('Error in reading all category:', error);
        return res.status(500).send({
            success: false,
            message: 'Error in reading all category',
            error: error.message,
        });
    }
};
