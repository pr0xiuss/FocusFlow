from django.db import models
from django.contrib.auth.models import User

# Create your models here.
class Task(models.Model):
    user=models.ForeignKey(User,on_delete=models.CASCADE,null=True,blank=True)
    title=models.CharField(max_length=100)
    description=models.TextField(blank=True,null=True)
    due_date=models.DateField(blank=True,null=True)
    category=models.CharField(max_length=50,blank=True,null=True)
    completed=models.BooleanField(default=False)
    created_at=models.DateTimeField(auto_now_add=True)
    parent_task=models.ForeignKey('self',on_delete=models.CASCADE,null=True,blank=True,related_name='subtasks')

    def __str__(self):
        return self.title
    
    def get_depth(self):
        depth=0
        cur=self
        while cur.parent_task:
            depth+=1
            cur=cur.parent_task
        return depth