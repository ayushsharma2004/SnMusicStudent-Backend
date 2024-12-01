import { matchData, readAllData, readFieldData, readSingleData, updateData, updateMatchData } from '../DB/crumd.js';
import { admin, db } from '../DB/firestore.js';
import slugify from 'slugify';


export const createTag = async (req, res) => {
    try {
        const { name } = req.body;
        const tagId = slugify(name)

        // Request Validation
        if (!name) {
            return res.send({ message: 'Tag name is required' });
        }
        if (!tagId) {
            return res.send({ message: 'Something went wrong' });
        }

        // Check if the tag is already registered
        const querySnapshot = await db
            .collection(process.env.adminCollection)
            .where('slug', '==', tagId)
            .get();
        if (!querySnapshot.empty) {
            return res.status(200).send({
                success: false,
                message: 'Tag already exists.',
            });
        }

        // Prepare tag object
        const tagJson = {
            tags: admin.firestore.FieldValue.arrayUnion({
                tagId: tagId,
                name: name,
                slug: tagId,
            }),
        };

        // Add tag details to the database
        await db.collection(process.env.adminCollection).doc('tags').update(tagJson);

        return res.status(201).send({
            success: true,
            message: 'Tag Created Successfully',
            tag: tagJson
        });
    } catch (error) {
        console.error('Error in tag creation:', error);
        return res.status(500).send({
            success: false,
            message: 'Error in tag creation',
            error: error.message,
        });
    }
};


export const readAllTag = async (req, res) => {
    try {
        var tag = await readFieldData(process.env.adminCollection, 'tags', 'tags');

        return res.status(201).send({
            success: true,
            message: 'All tag read successfully',
            tag: tag
        });
    } catch (error) {
        console.error('Error in reading all tag:', error);
        return res.status(500).send({
            success: false,
            message: 'Error in reading all tag',
            error: error.message,
        });
    }
};
