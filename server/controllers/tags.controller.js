import * as tagsService from "../services/tags.service.js";

export async function getTags(req, res) {
    try {
        const result = await tagsService.listTags();
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Tags.' });
    }
}

export async function createTag(req, res) {
    const { name } = req.body;
    if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name ist erforderlich.' });
    }
    try {
        const result = await tagsService.createTag(name.trim());
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            res.status(409).json({ error: 'Tag existiert bereits.' });
        } else {
            console.error('Error creating tag:', error);
            res.status(500).json({ error: 'Fehler beim Erstellen des Tags.' });
        }
    }
}

export async function updateTag(req, res) {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name ist erforderlich.' });
    }
    try {
        const result = await tagsService.updateTag(id, name.trim());
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Tag nicht gefunden.' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            res.status(409).json({ error: 'Tag-Name wird bereits verwendet.' });
        } else {
            console.error('Error updating tag:', error);
            res.status(500).json({ error: 'Fehler beim Aktualisieren des Tags.' });
        }
    }
}

export async function deleteTag(req, res) {
    const { id } = req.params;
    try {
        const result = await tagsService.removeTag(id);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Tag nicht gefunden.' });
        }
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting tag:', error);
        res.status(500).json({ error: 'Fehler beim Löschen des Tags.' });
    }
}
