const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { field } = req.query;
    let query = 'SELECT * FROM projects WHERE isPublished = 1';
    const params = [];

    if (field) {
      query += ' AND field = ?';
      params.push(field);
    }
    query += ' ORDER BY createdAt DESC';

    const [projects] = await req.db.query(query, params);
    const [fields] = await req.db.query('SELECT DISTINCT field FROM projects WHERE isPublished = 1');

    projects.forEach(p => {
      try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; }
      try { p.technologies = JSON.parse(p.technologies || '[]'); } catch(e) { p.technologies = []; }
      try { p.features = JSON.parse(p.features || '[]'); } catch(e) { p.features = []; }
    });

    res.render('projects', {
      title: 'Projects - Ardthon Solutions',
      projects,
      fields: fields.map(f => f.field),
      currentField: field || ''
    });
  } catch (err) {
    console.error('Projects error:', err);
    res.redirect('/');
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const [projects] = await req.db.query(
      'SELECT * FROM projects WHERE slug = ? AND isPublished = 1',
      [req.params.slug]
    );

    if (projects.length === 0) {
      req.flash('error_msg', 'Project not found');
      return res.redirect('/projects');
    }

    const project = projects[0];
    try { project.images = JSON.parse(project.images || '[]'); } catch(e) { project.images = []; }
    try { project.technologies = JSON.parse(project.technologies || '[]'); } catch(e) { project.technologies = []; }
    try { project.features = JSON.parse(project.features || '[]'); } catch(e) { project.features = []; }

    // If it's the CuePay project, show special page
    if (project.slug === 'cuepay-pool-automation') {
      return res.render('projects-cuepay', {
        title: 'CuePay - Pool Automation - Ardthon Solutions',
        project
      });
    }

    res.render('project-detail', {
      title: `${project.title} - Ardthon Solutions`,
      project
    });
  } catch (err) {
    console.error('Project detail error:', err);
    res.redirect('/projects');
  }
});

module.exports = router;